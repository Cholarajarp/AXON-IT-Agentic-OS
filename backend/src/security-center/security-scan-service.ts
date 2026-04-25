import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type {
  SecurityCategory,
  SecurityFinding,
  SecurityScanFile,
  SecurityScanInput,
  SecurityScanResult,
  SecuritySeverity,
} from './types.js';

const ignoredDirs = new Set([
  '.git',
  '.idea',
  '.vscode',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.cache',
  '.axon',
]);

const textExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.sql',
  '.prisma',
  '.env',
  '.md',
  '.yml',
  '.yaml',
  '.toml',
  '.py',
  '.go',
  '.rs',
  '.java',
]);

const secretPatterns: Array<{ id: string; title: string; pattern: RegExp; severity: SecuritySeverity }> = [
  { id: 'openai-key', title: 'OpenAI API key pattern detected', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g, severity: 'CRITICAL' },
  { id: 'anthropic-key', title: 'Anthropic API key pattern detected', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, severity: 'CRITICAL' },
  { id: 'aws-access-key', title: 'AWS access key pattern detected', pattern: /\bAKIA[0-9A-Z]{16}\b/g, severity: 'CRITICAL' },
  { id: 'jwt-token', title: 'JWT-like token detected', pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/g, severity: 'HIGH' },
  {
    id: 'generic-secret-assignment',
    title: 'Hard-coded secret assignment detected',
    pattern: /\b(api[_-]?key|secret|password|token)\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{16,}/gi,
    severity: 'HIGH',
  },
];

export class SecurityCenterService {
  async scan(input: SecurityScanInput = {}): Promise<SecurityScanResult> {
    const files = input.files ?? await this.readWorkspaceFiles(input.workspacePath, input.maxFiles ?? 500);
    const findings: SecurityFinding[] = [];

    for (const file of files) {
      findings.push(...scanSecrets(file));
      findings.push(...scanCodeRisks(file));
      findings.push(...scanDatabaseRisks(file));
      findings.push(...scanDependencyManifest(file));
    }

    findings.push(...scanWorkspaceLevel(files));

    const categories = countByCategory(findings);
    const score = scoreFindings(findings);
    const status = findings.some((finding) => finding.blocksPublish && finding.severity === 'CRITICAL')
      ? 'blocked'
      : findings.some((finding) => finding.blocksPublish || finding.severity === 'HIGH')
        ? 'needs-review'
        : 'safe-to-preview';

    return {
      id: `sec_${nanoid(10)}`,
      score,
      status,
      summary: summarize(status, findings),
      scannedFiles: files.length,
      findings,
      publishGates: [
        {
          id: 'no-critical-secrets',
          title: 'No exposed production secrets',
          passed: !findings.some((finding) => finding.category === 'secret' && finding.severity === 'CRITICAL'),
          evidence: ['secret pattern scan', 'provider key storage review'],
        },
        {
          id: 'dependency-lockfile',
          title: 'Dependency lockfiles and manifests reviewed',
          passed: !findings.some((finding) => finding.id === 'missing-lockfile'),
          evidence: ['package manifest scan', 'lockfile presence'],
        },
        {
          id: 'database-access',
          title: 'Database schema and access controls reviewed',
          passed: !findings.some((finding) => finding.category === 'database' && finding.blocksPublish),
          evidence: ['SQL/RLS scan', 'migration review'],
        },
        {
          id: 'browser-token-safety',
          title: 'Browser token handling reviewed',
          passed: !findings.some((finding) => finding.id === 'browser-token-storage'),
          evidence: ['frontend auth scan', 'storage usage review'],
        },
      ],
      categories,
      createdAt: new Date().toISOString(),
    };
  }

  private async readWorkspaceFiles(workspacePath?: string, maxFiles = 500): Promise<SecurityScanFile[]> {
    const root = resolveWorkspaceRoot(workspacePath);
    const files: SecurityScanFile[] = [];

    const visit = async (directory: string) => {
      if (files.length >= maxFiles) return;
      const entries = await readdir(directory, { withFileTypes: true });
      for (const entry of entries) {
        if (files.length >= maxFiles) break;
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (!ignoredDirs.has(entry.name)) await visit(fullPath);
          continue;
        }
        if (!entry.isFile() || !shouldReadFile(entry.name)) continue;
        const info = await stat(fullPath);
        if (info.size > 512_000) continue;
        const content = await readFile(fullPath, 'utf8').catch(() => '');
        if (!content) continue;
        files.push({ path: path.relative(root, fullPath).replace(/\\/g, '/'), content });
      }
    };

    await visit(root);
    return files;
  }
}

function resolveWorkspaceRoot(workspacePath?: string) {
  const cwd = process.cwd();
  const defaultRoot = path.basename(cwd) === 'backend' ? path.resolve(cwd, '..') : cwd;
  if (!workspacePath) return defaultRoot;

  const resolved = path.resolve(workspacePath);
  if (!resolved.startsWith(defaultRoot)) {
    throw new Error('workspacePath must stay inside the AXON workspace');
  }
  return resolved;
}

function shouldReadFile(fileName: string) {
  if (fileName === 'package-lock.json' || fileName === 'package.json') return true;
  return textExtensions.has(path.extname(fileName).toLowerCase());
}

function scanSecrets(file: SecurityScanFile): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const lines = file.content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/masked|example|placeholder|your[-_ ]?key|sk-\*\*\*/i.test(line)) return;
    for (const secret of secretPatterns) {
      secret.pattern.lastIndex = 0;
      if (!secret.pattern.test(line)) continue;
      findings.push({
        id: `secret-${secret.id}-${file.path}-${index + 1}`,
        severity: secret.severity,
        category: 'secret',
        title: secret.title,
        detail: 'A credential-like value appears in source text. Browser-visible or committed secrets can lead to unauthorized access.',
        filePath: file.path,
        line: index + 1,
        excerpt: redact(line.trim()),
        recommendation: 'Move the value into AXON provider settings, environment secrets, or a server-side secret manager. Rotate it if it was real.',
        blocksPublish: true,
      });
    }
  });
  return findings;
}

function scanCodeRisks(file: SecurityScanFile): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const checks: Array<{ id: string; pattern: RegExp; title: string; detail: string; recommendation: string; severity: SecuritySeverity; category: SecurityCategory; blocksPublish: boolean }> = [
    {
      id: 'dangerous-html',
      pattern: /dangerouslySetInnerHTML|\.innerHTML\s*=/,
      title: 'Unsafe HTML injection pattern',
      detail: 'Direct HTML injection can introduce XSS when user-controlled content reaches this path.',
      recommendation: 'Render structured components or sanitize HTML with a reviewed sanitizer before rendering.',
      severity: 'HIGH',
      category: 'code',
      blocksPublish: true,
    },
    {
      id: 'browser-token-storage',
      pattern: /localStorage\.setItem\([^)]*(token|jwt|session|secret)/i,
      title: 'Sensitive token stored in localStorage',
      detail: 'Tokens in localStorage are exposed to XSS and can survive longer than intended.',
      recommendation: 'Use httpOnly secure cookies or short-lived in-memory tokens with refresh protection.',
      severity: 'HIGH',
      category: 'auth',
      blocksPublish: true,
    },
    {
      id: 'open-cors',
      pattern: /origin\s*:\s*['"]\*['"]|cors\([^)]*\*\s*\)/i,
      title: 'Open CORS configuration',
      detail: 'Wildcard CORS can expose APIs to untrusted browser origins.',
      recommendation: 'Restrict CORS to known app domains per environment.',
      severity: 'MEDIUM',
      category: 'auth',
      blocksPublish: false,
    },
  ];

  const lines = file.content.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const check of checks) {
      if (!check.pattern.test(line)) continue;
      findings.push({
        id: `${check.id}-${file.path}-${index + 1}`,
        severity: check.severity,
        category: check.category,
        title: check.title,
        detail: check.detail,
        filePath: file.path,
        line: index + 1,
        excerpt: line.trim().slice(0, 180),
        recommendation: check.recommendation,
        blocksPublish: check.blocksPublish,
      });
    }
  });

  return findings;
}

function scanDatabaseRisks(file: SecurityScanFile): SecurityFinding[] {
  if (!/\.(sql|prisma)$/i.test(file.path) && !/migration|supabase|schema/i.test(file.path)) return [];
  const findings: SecurityFinding[] = [];
  const lower = file.content.toLowerCase();
  const createsTable = /\bcreate\s+table\b/.test(lower);
  const enablesRls = /\benable\s+row\s+level\s+security\b/.test(lower);

  if (createsTable && /auth|user|tenant|customer|account|profile|ticket|invoice/.test(lower) && !enablesRls) {
    findings.push({
      id: `database-missing-rls-${file.path}`,
      severity: 'HIGH',
      category: 'database',
      title: 'Database table may need row-level access control',
      detail: 'User, tenant, account, customer, or ticket data appears in a schema file without an obvious row-level security enablement.',
      filePath: file.path,
      recommendation: 'Add tenant-scoped access policies or document why this table is not user-addressable.',
      blocksPublish: true,
    });
  }

  if (/\bdrop\s+table\b|\btruncate\s+table\b|\bdelete\s+from\b(?![\s\S]{0,80}\bwhere\b)/i.test(file.content)) {
    findings.push({
      id: `database-destructive-sql-${file.path}`,
      severity: 'CRITICAL',
      category: 'database',
      title: 'Destructive SQL requires migration safety review',
      detail: 'Destructive database operations can cause data loss or downtime when published without review.',
      filePath: file.path,
      recommendation: 'Run the Database Pipeline and attach rollback, backup, and quality-gate evidence.',
      blocksPublish: true,
    });
  }

  return findings;
}

function scanDependencyManifest(file: SecurityScanFile): SecurityFinding[] {
  if (!file.path.endsWith('package.json')) return [];
  const findings: SecurityFinding[] = [];
  const parsed = safeJson(file.content) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; scripts?: Record<string, string> } | null;
  if (!parsed) return findings;

  const allDeps = { ...parsed.dependencies, ...parsed.devDependencies };
  for (const [name, version] of Object.entries(allDeps)) {
    if (version === '*' || version.toLowerCase() === 'latest') {
      findings.push({
        id: `dependency-floating-${name}`,
        severity: 'MEDIUM',
        category: 'dependency',
        title: 'Floating dependency version',
        detail: `${name} uses ${version}, which can change without review and break reproducible builds.`,
        filePath: file.path,
        recommendation: 'Pin dependency ranges and keep lockfiles committed.',
        blocksPublish: false,
      });
    }
  }

  for (const [script, command] of Object.entries(parsed.scripts ?? {})) {
    if (/curl\s+.+\|\s*(sh|bash)|wget\s+.+\|\s*(sh|bash)/i.test(command)) {
      findings.push({
        id: `dependency-unsafe-script-${script}`,
        severity: 'HIGH',
        category: 'dependency',
        title: 'Install script pipes remote code into a shell',
        detail: `Script "${script}" executes remote content directly, which is unsafe for enterprise publishing.`,
        filePath: file.path,
        recommendation: 'Replace with pinned package manager installs or reviewed scripts stored in the repository.',
        blocksPublish: true,
      });
    }
  }

  return findings;
}

function scanWorkspaceLevel(files: SecurityScanFile[]): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const paths = new Set(files.map((file) => file.path));
  if (paths.has('package.json') && !paths.has('package-lock.json') && !paths.has('pnpm-lock.yaml') && !paths.has('yarn.lock')) {
    findings.push({
      id: 'missing-lockfile',
      severity: 'HIGH',
      category: 'dependency',
      title: 'Dependency lockfile missing',
      detail: 'A JavaScript package manifest exists without a lockfile, so installs are not reproducible.',
      recommendation: 'Commit a package lockfile and run dependency audit before publishing.',
      blocksPublish: true,
    });
  }
  return findings;
}

function safeJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function redact(value: string) {
  return value
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, 'sk-••••••••')
    .replace(/\bsk-ant-[A-Za-z0-9_-]{8,}\b/g, 'sk-ant-••••••••')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, 'AKIA••••••••••••••••')
    .replace(/([:=]\s*['"]?)[A-Za-z0-9_./+=-]{12,}/g, '$1••••••••');
}

function scoreFindings(findings: SecurityFinding[]) {
  const weights: Record<SecuritySeverity, number> = { LOW: 3, MEDIUM: 8, HIGH: 18, CRITICAL: 35 };
  const penalty = findings.reduce((total, finding) => total + weights[finding.severity], 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

function summarize(status: SecurityScanResult['status'], findings: SecurityFinding[]) {
  if (status === 'blocked') return `Publishing blocked: ${findings.filter((finding) => finding.blocksPublish).length} blocking security issue(s) found.`;
  if (status === 'needs-review') return `Security review required: ${findings.length} finding(s) need triage before launch.`;
  return 'Workspace passed the first publish-safety scan.';
}

function countByCategory(findings: SecurityFinding[]): Record<SecurityCategory, number> {
  return {
    secret: findings.filter((finding) => finding.category === 'secret').length,
    dependency: findings.filter((finding) => finding.category === 'dependency').length,
    database: findings.filter((finding) => finding.category === 'database').length,
    auth: findings.filter((finding) => finding.category === 'auth').length,
    code: findings.filter((finding) => finding.category === 'code').length,
    publish: findings.filter((finding) => finding.category === 'publish').length,
  };
}

export const securityCenter = new SecurityCenterService();
