import { nanoid } from 'nanoid';
import type {
  AccessibilityFinding,
  BrowserDeviceProfile,
  BrowserJourneyInput,
  BrowserJourneyRun,
  BrowserQaArtifact,
  BrowserQaInput,
  BrowserQaReport,
  PreviewProbe,
  ValidationEvidenceInput,
} from './types.js';

const reports = new Map<string, BrowserQaReport>();

const defaultHtml = `
<!doctype html>
<html lang="en">
  <head><title>AXON Generated Preview</title></head>
  <body>
    <main>
      <h1>AXON product preview</h1>
      <button type="button">Start</button>
      <form><label>Email <input name="email" type="email" /></label></form>
    </main>
  </body>
</html>`;

export class BrowserQaService {
  listReports(): BrowserQaReport[] {
    return Array.from(reports.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getReport(id: string): BrowserQaReport | undefined {
    return reports.get(id);
  }

  async createReport(input: BrowserQaInput): Promise<BrowserQaReport> {
    const startedAt = Date.now();
    const name = input.name?.trim() || inferName(input.releaseGoal);
    const releaseGoal = input.releaseGoal?.trim() || 'Validate generated application preview before customer release.';
    const deviceProfiles = input.deviceProfiles?.length ? input.deviceProfiles : (['desktop', 'mobile'] satisfies BrowserDeviceProfile[]);
    const journeys = input.journeys?.length ? input.journeys : defaultJourneys(releaseGoal);
    const page = await loadPreview(input.targetUrl, input.htmlSnapshot);
    const accessibilityFindings = analyzeAccessibility(page.html);
    const journeyRuns = journeys.map((journey, index) =>
      runJourney(journey, index, page, deviceProfiles, accessibilityFindings, startedAt),
    );
    const validationEvidence = normalizeValidation(input.validationEvidence);
    const score = calculateScore(page.preview, journeyRuns, accessibilityFindings, validationEvidence);
    const status = inferStatus(score, page.preview, journeyRuns, accessibilityFindings, validationEvidence);
    const releaseEvidence = buildReleaseEvidence(page.preview, journeyRuns, accessibilityFindings, validationEvidence, score, status);
    const artifacts = buildArtifacts(name, input.targetUrl, journeys, deviceProfiles, accessibilityFindings, releaseEvidence);
    const nextActions = buildNextActions(page.preview, journeyRuns, accessibilityFindings, validationEvidence);

    const report: BrowserQaReport = {
      id: `qa_${nanoid(10)}`,
      tenantId: input.tenantId ?? 'tenant_default',
      name,
      releaseGoal,
      targetUrl: input.targetUrl,
      status,
      score,
      summary: buildSummary(name, status, score, journeyRuns, accessibilityFindings),
      preview: page.preview,
      journeys: journeyRuns,
      accessibilityFindings,
      validationEvidence,
      releaseEvidence,
      artifacts,
      nextActions,
      createdAt: new Date().toISOString(),
    };

    reports.set(report.id, report);
    return report;
  }
}

interface LoadedPreview {
  html: string;
  preview: PreviewProbe;
}

async function loadPreview(targetUrl?: string, htmlSnapshot?: string): Promise<LoadedPreview> {
  if (htmlSnapshot?.trim()) {
    return {
      html: htmlSnapshot,
      preview: {
        url: targetUrl,
        reachable: true,
        statusCode: 200,
        responseMs: 0,
        contentType: 'text/html; source=inline-snapshot',
        title: extractTitle(htmlSnapshot),
      },
    };
  }

  if (!targetUrl?.trim()) {
    return {
      html: defaultHtml,
      preview: {
        reachable: false,
        error: 'No preview URL was supplied. Offline fallback was analyzed so the QA plan can still be generated.',
        title: 'AXON Generated Preview',
      },
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  const startedAt = Date.now();
  try {
    const response = await fetch(targetUrl, {
      headers: { accept: 'text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.5' },
      signal: controller.signal,
    });
    const contentType = response.headers.get('content-type') ?? undefined;
    const body = await response.text();
    return {
      html: body,
      preview: {
        url: targetUrl,
        reachable: response.ok,
        statusCode: response.status,
        responseMs: Date.now() - startedAt,
        contentType,
        title: extractTitle(body),
        error: response.ok ? undefined : `Preview returned HTTP ${response.status}.`,
      },
    };
  } catch (error) {
    return {
      html: '',
      preview: {
        url: targetUrl,
        reachable: false,
        responseMs: Date.now() - startedAt,
        error: (error as Error).name === 'AbortError' ? 'Preview request timed out after 7 seconds.' : (error as Error).message,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function runJourney(
  journey: BrowserJourneyInput,
  index: number,
  page: LoadedPreview,
  deviceProfiles: BrowserDeviceProfile[],
  accessibilityFindings: AccessibilityFinding[],
  startedAt: number,
): BrowserJourneyRun {
  const path = journey.path || '/';
  const assertions = (journey.assertions?.length ? journey.assertions : ['title', 'main']).map((assertion) => {
    const token = assertion.toLowerCase().replace(/^text:/, '').trim();
    const passed = token === 'title'
      ? Boolean(page.preview.title)
      : token === 'main'
        ? /<main[\s>]/i.test(page.html)
        : page.html.toLowerCase().includes(token);
    return {
      text: assertion,
      passed,
      evidence: passed ? `Found ${assertion}` : `Missing ${assertion}`,
    };
  });

  const blockingA11y = accessibilityFindings.filter((finding) => finding.blocksRelease).length;
  let status: BrowserJourneyRun['status'] = 'pass';
  if (!page.preview.reachable && page.preview.url) status = journey.critical === false ? 'warn' : 'fail';
  else if (!page.preview.reachable) status = 'skipped';
  else if (assertions.some((assertion) => !assertion.passed)) status = journey.critical === false ? 'warn' : 'fail';
  else if (blockingA11y > 0) status = 'warn';

  return {
    id: `journey_${index + 1}`,
    name: journey.name,
    path,
    intent: journey.intent || `Validate ${journey.name.toLowerCase()} across generated UI.`,
    status,
    critical: journey.critical ?? index === 0,
    deviceProfiles,
    assertions,
    evidence: [
      page.preview.url ? `preview URL ${joinUrl(page.preview.url, path)}` : 'offline HTML snapshot analyzed',
      `browser smoke result ${status}`,
      `${deviceProfiles.length} viewport profile(s): ${deviceProfiles.join(', ')}`,
      `${assertions.filter((assertion) => assertion.passed).length}/${assertions.length} assertion(s) passed`,
    ],
    durationMs: Math.max(1, Date.now() - startedAt),
  };
}

function analyzeAccessibility(html: string): AccessibilityFinding[] {
  const findings: AccessibilityFinding[] = [];
  if (!html.trim()) {
    findings.push({
      id: 'empty-preview',
      severity: 'HIGH',
      title: 'Preview returned no inspectable HTML',
      detail: 'AXON could not inspect document structure, accessibility landmarks, or page content.',
      recommendation: 'Start the generated app preview and rerun Browser QA before release.',
      blocksRelease: true,
    });
    return findings;
  }

  if (!/<html[^>]+lang=/i.test(html)) {
    findings.push(finding('missing-lang', 'MEDIUM', 'HTML language is not declared', 'Screen readers need a document language to pronounce content correctly.', 'Add lang="en" or the correct locale to the html element.', false));
  }
  if (!/<title>[^<]{2,}<\/title>/i.test(html)) {
    findings.push(finding('missing-title', 'HIGH', 'Document title is missing', 'Browser tabs and assistive technologies need a meaningful page title.', 'Add a concise product or screen title.', true));
  }
  if (!/<main[\s>]/i.test(html)) {
    findings.push(finding('missing-main', 'MEDIUM', 'Main landmark is missing', 'Keyboard and screen-reader users need a main landmark for navigation.', 'Wrap the primary application surface in a main element.', false));
  }
  if (!/<h1[\s>][\s\S]*?<\/h1>/i.test(html)) {
    findings.push(finding('missing-h1', 'LOW', 'Primary heading is missing', 'Pages should expose one clear primary heading for orientation.', 'Add a visible h1 that names the current app or workspace.', false));
  }

  const buttonMatches = html.match(/<button\b[^>]*>([\s\S]*?)<\/button>/gi) ?? [];
  const emptyButtons = buttonMatches.filter((button) => !stripTags(button).trim() && !/aria-label=/i.test(button));
  if (emptyButtons.length > 0) {
    findings.push(finding('unnamed-buttons', 'HIGH', 'Buttons without accessible names', `${emptyButtons.length} button(s) appear to have no text or aria-label.`, 'Use visible text or aria-label for icon-only buttons.', true));
  }

  const inputMatches = html.match(/<input\b[^>]*>/gi) ?? [];
  const unlabeledInputs = inputMatches.filter((input) => !/aria-label=|aria-labelledby=|id=/i.test(input));
  if (unlabeledInputs.length > 0 && !/<label[\s>]/i.test(html)) {
    findings.push(finding('unlabeled-inputs', 'HIGH', 'Inputs may be unlabeled', `${unlabeledInputs.length} input(s) have no obvious label relationship.`, 'Use label elements, aria-label, or aria-labelledby for every input.', true));
  }

  const imageMatches = html.match(/<img\b[^>]*>/gi) ?? [];
  const missingAlt = imageMatches.filter((image) => !/\salt=/i.test(image));
  if (missingAlt.length > 0) {
    findings.push(finding('missing-image-alt', 'MEDIUM', 'Images missing alt text', `${missingAlt.length} image(s) do not declare alt text.`, 'Add meaningful alt text or alt="" for decorative images.', false));
  }

  if (/\son[a-z]+\s*=/i.test(html)) {
    findings.push(finding('inline-event-handlers', 'MEDIUM', 'Inline event handlers detected', 'Inline handlers make CSP hardening and auditing weaker.', 'Move handlers into bundled application code and enforce a strict CSP.', false));
  }
  if (/target=["']_blank["']/i.test(html) && !/rel=["'][^"']*(noopener|noreferrer)/i.test(html)) {
    findings.push(finding('target-blank-rel', 'MEDIUM', 'External links need noopener', 'Links opened in a new tab can access the opener without rel protection.', 'Add rel="noopener noreferrer" to target="_blank" links.', false));
  }

  return findings;
}

function normalizeValidation(input?: ValidationEvidenceInput[]): ValidationEvidenceInput[] {
  if (input?.length) return input;
  return [
    {
      kind: 'e2e',
      status: 'planned',
      command: 'npm run test:e2e',
      summary: 'Playwright command generated but not executed by Browser QA.',
    },
  ];
}

function calculateScore(
  preview: PreviewProbe,
  journeys: BrowserJourneyRun[],
  findings: AccessibilityFinding[],
  validationEvidence: ValidationEvidenceInput[],
) {
  const journeyScore = journeys.length
    ? journeys.reduce((sum, journey) => sum + (journey.status === 'pass' ? 100 : journey.status === 'warn' ? 65 : journey.status === 'skipped' ? 45 : 0), 0) / journeys.length
    : 0;
  const validationScore = validationEvidence.reduce((sum, item) => sum + (item.status === 'pass' ? 100 : item.status === 'warn' ? 65 : item.status === 'planned' ? 45 : 0), 0) / Math.max(1, validationEvidence.length);
  const a11yPenalty = findings.reduce((sum, item) => sum + (item.severity === 'HIGH' ? 18 : item.severity === 'MEDIUM' ? 9 : 4), 0);
  const previewScore = preview.reachable ? 100 : preview.url ? 0 : 55;
  return Math.max(0, Math.min(100, Math.round(previewScore * 0.2 + journeyScore * 0.35 + validationScore * 0.25 + Math.max(0, 100 - a11yPenalty) * 0.2)));
}

function inferStatus(
  score: number,
  preview: PreviewProbe,
  journeys: BrowserJourneyRun[],
  findings: AccessibilityFinding[],
  validationEvidence: ValidationEvidenceInput[],
): BrowserQaReport['status'] {
  const failedCriticalJourney = journeys.some((journey) => journey.critical && journey.status === 'fail');
  const failedValidation = validationEvidence.some((item) => item.status === 'fail');
  const blockingA11y = findings.some((findingItem) => findingItem.blocksRelease);
  if ((preview.url && !preview.reachable) || failedCriticalJourney || failedValidation || blockingA11y) return 'blocked';
  if (score >= 85 && validationEvidence.some((item) => item.status === 'pass')) return 'release-ready';
  return 'needs-review';
}

function buildReleaseEvidence(
  preview: PreviewProbe,
  journeys: BrowserJourneyRun[],
  findings: AccessibilityFinding[],
  validationEvidence: ValidationEvidenceInput[],
  score: number,
  status: BrowserQaReport['status'],
) {
  return [
    preview.url ? `preview URL ${preview.url}` : 'preview URL offline snapshot',
    `browser smoke result ${status} score ${score}%`,
    `screenshot or trace plan browser-qa/playwright/preview.spec.ts`,
    `accessibility scan ${findings.length} finding(s)`,
    ...journeys.map((journey) => `journey ${journey.name} ${journey.status}`),
    ...validationEvidence.map((item) => `test output ${item.kind} ${item.status}${item.command ? ` via ${item.command}` : ''}`),
  ];
}

function buildArtifacts(
  name: string,
  targetUrl: string | undefined,
  journeys: BrowserJourneyInput[],
  devices: BrowserDeviceProfile[],
  findings: AccessibilityFinding[],
  releaseEvidence: string[],
): BrowserQaArtifact[] {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'preview';
  return [
    {
      id: 'playwright-spec',
      kind: 'playwright-spec',
      path: `browser-qa/${slug}/preview.spec.ts`,
      contentPreview: buildPlaywrightSpec(targetUrl || 'about:blank', journeys, devices),
    },
    {
      id: 'screenshot-plan',
      kind: 'screenshot-plan',
      path: `browser-qa/${slug}/screenshots/`,
      contentPreview: devices.map((device) => `${device}: capture homepage plus all critical journeys`).join('\n'),
    },
    {
      id: 'trace-plan',
      kind: 'trace-plan',
      path: `browser-qa/${slug}/traces/`,
      contentPreview: 'Enable Playwright trace:on-first-retry and attach trace.zip to Release Command evidence.',
    },
    {
      id: 'accessibility-report',
      kind: 'accessibility-report',
      path: `browser-qa/${slug}/accessibility.json`,
      contentPreview: JSON.stringify(findings.slice(0, 6), null, 2),
    },
    {
      id: 'release-evidence',
      kind: 'release-evidence',
      path: `browser-qa/${slug}/release-evidence.txt`,
      contentPreview: releaseEvidence.join('\n'),
    },
  ];
}

function buildNextActions(
  preview: PreviewProbe,
  journeys: BrowserJourneyRun[],
  findings: AccessibilityFinding[],
  validationEvidence: ValidationEvidenceInput[],
) {
  const actions: string[] = [];
  if (preview.url && !preview.reachable) actions.push('Start or redeploy the preview environment, then rerun Browser QA.');
  if (!preview.url) actions.push('Attach a live preview URL from Build Studio or deployment preview.');
  if (journeys.some((journey) => journey.status === 'fail')) actions.push('Fix failing critical journeys before customer preview.');
  if (findings.some((findingItem) => findingItem.blocksRelease)) actions.push('Resolve blocking accessibility findings and rerun the report.');
  if (!validationEvidence.some((item) => item.status === 'pass')) actions.push('Attach passing typecheck, test, build, or e2e evidence.');
  if (actions.length === 0) actions.push('Attach screenshots/traces to Release Command and move to staged rollout.');
  return actions;
}

function buildSummary(
  name: string,
  status: BrowserQaReport['status'],
  score: number,
  journeys: BrowserJourneyRun[],
  findings: AccessibilityFinding[],
) {
  return `${name} Browser QA is ${status} at ${score}% with ${journeys.filter((journey) => journey.status === 'pass').length}/${journeys.length} journey(s) passing and ${findings.length} accessibility finding(s).`;
}

function defaultJourneys(goal: string): BrowserJourneyInput[] {
  const lower = goal.toLowerCase();
  const journeys: BrowserJourneyInput[] = [
    {
      name: 'First viewport loads',
      path: '/',
      intent: 'Confirm the generated app renders the primary experience.',
      assertions: ['title', 'main'],
      critical: true,
    },
    {
      name: 'Primary action is discoverable',
      path: '/',
      intent: 'Confirm users can find a useful action without instructions.',
      assertions: ['button'],
      critical: true,
    },
  ];
  if (/(login|auth|account|user)/.test(lower)) journeys.push({ name: 'Auth surface is visible', path: '/', assertions: ['email', 'password'], critical: true });
  if (/(dashboard|analytics|admin|ops)/.test(lower)) journeys.push({ name: 'Dashboard content is visible', path: '/', assertions: ['dashboard'], critical: false });
  if (/(database|data|table|crud)/.test(lower)) journeys.push({ name: 'Data workflow is visible', path: '/', assertions: ['data'], critical: false });
  return journeys;
}

function finding(
  id: string,
  severity: AccessibilityFinding['severity'],
  title: string,
  detail: string,
  recommendation: string,
  blocksRelease: boolean,
): AccessibilityFinding {
  return { id, severity, title, detail, recommendation, blocksRelease };
}

function buildPlaywrightSpec(targetUrl: string, journeys: BrowserJourneyInput[], devices: BrowserDeviceProfile[]) {
  const viewportFor = (device: BrowserDeviceProfile) => {
    if (device === 'mobile') return '{ width: 390, height: 844 }';
    if (device === 'tablet') return '{ width: 820, height: 1180 }';
    return '{ width: 1440, height: 960 }';
  };
  const tests = journeys.map((journey) => {
    const assertions = (journey.assertions ?? ['title', 'main']).map((assertion) => `    await expect(page.locator('body')).toContainText(/${escapeRegex(assertion.replace(/^text:/, ''))}/i);`).join('\n');
    return `  test('${escapeString(journey.name)}', async ({ page }) => {\n    await page.goto('${joinUrl(targetUrl, journey.path || '/')}');\n${assertions}\n  });`;
  }).join('\n\n');
  return `import { expect, test } from '@playwright/test';\n\nconst devices = [${devices.map((device) => `{ name: '${device}', viewport: ${viewportFor(device)} }`).join(', ')}];\n\nfor (const device of devices) {\n  test.describe(device.name, () => {\n    test.use({ viewport: device.viewport });\n\n${tests}\n  });\n}\n`;
}

function extractTitle(html: string) {
  return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
}

function joinUrl(base: string, path: string) {
  try {
    return new URL(path || '/', base).toString();
  } catch {
    return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }
}

function inferName(goal?: string) {
  const clean = goal?.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Generated App Preview';
  return clean.length > 54 ? `${clean.slice(0, 51)}...` : clean;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export const browserQa = new BrowserQaService();
