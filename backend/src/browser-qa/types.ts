export type BrowserQaStatus = 'release-ready' | 'needs-review' | 'blocked';
export type BrowserJourneyStatus = 'pass' | 'warn' | 'fail' | 'skipped';
export type BrowserDeviceProfile = 'desktop' | 'tablet' | 'mobile';
export type BrowserQaEvidenceMode = 'live-url' | 'html-snapshot' | 'generated-fallback';
export type ValidationEvidenceKind = 'typecheck' | 'unit' | 'integration' | 'build' | 'e2e' | 'security' | 'accessibility';
export type ValidationEvidenceStatus = 'pass' | 'warn' | 'fail' | 'planned';

export interface BrowserJourneyInput {
  name: string;
  path?: string;
  intent?: string;
  assertions?: string[];
  critical?: boolean;
}

export interface ValidationEvidenceInput {
  kind: ValidationEvidenceKind;
  status: ValidationEvidenceStatus;
  command?: string;
  summary?: string;
}

export interface BrowserQaInput {
  tenantId?: string;
  name?: string;
  releaseGoal?: string;
  targetUrl?: string;
  htmlSnapshot?: string;
  journeys?: BrowserJourneyInput[];
  deviceProfiles?: BrowserDeviceProfile[];
  validationEvidence?: ValidationEvidenceInput[];
}

export interface PreviewProbe {
  url?: string;
  reachable: boolean;
  statusCode?: number;
  responseMs?: number;
  contentType?: string;
  title?: string;
  error?: string;
}

export interface AccessibilityFinding {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  title: string;
  detail: string;
  recommendation: string;
  blocksRelease: boolean;
}

export interface BrowserJourneyRun {
  id: string;
  name: string;
  path: string;
  intent: string;
  status: BrowserJourneyStatus;
  critical: boolean;
  deviceProfiles: BrowserDeviceProfile[];
  assertions: Array<{
    text: string;
    passed: boolean;
    evidence: string;
  }>;
  evidence: string[];
  durationMs: number;
}

export interface BrowserQaArtifact {
  id: string;
  kind: 'playwright-spec' | 'screenshot-plan' | 'trace-plan' | 'accessibility-report' | 'release-evidence';
  path: string;
  contentPreview: string;
}

export interface BrowserQaReport {
  id: string;
  tenantId: string;
  name: string;
  releaseGoal: string;
  targetUrl?: string;
  evidenceMode: BrowserQaEvidenceMode;
  status: BrowserQaStatus;
  score: number;
  summary: string;
  preview: PreviewProbe;
  journeys: BrowserJourneyRun[];
  accessibilityFindings: AccessibilityFinding[];
  validationEvidence: ValidationEvidenceInput[];
  releaseEvidence: string[];
  artifacts: BrowserQaArtifact[];
  nextActions: string[];
  createdAt: string;
}
