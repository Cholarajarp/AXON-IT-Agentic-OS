import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type {
  DuplicateConfig,
  LegacyComparison,
  StructureFinding,
  StructureScanInput,
  StructureScanResult,
} from './types.js';

const repoMarkers = ['package.json', 'src', 'backend'];
const legacyRootRelativePath = 'legacy/it-agentic-os';
const duplicateConfigFiles: string[] = [];
const ignoredComparisonDirs = new Set([
  '.git',
  '.idea',
  '.vscode',
  'legacy',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.cache',
]);

export class StructureGuardianService {
  async scan(input: StructureScanInput = {}): Promise<StructureScanResult> {
    const workspaceRoot = resolveWorkspaceRoot(input.workspacePath);
    const includeNested = input.includeNested ?? true;
    const nestedRoot = path.join(workspaceRoot, legacyRootRelativePath);

    const rootPackage = await readJson<{ name?: string }>(path.join(workspaceRoot, 'package.json'));
    const hasRootMarkers = await allExist(workspaceRoot, repoMarkers);
    const hasNestedRoot = includeNested && (await exists(nestedRoot));
    const hasNestedGit = hasNestedRoot && (await exists(path.join(nestedRoot, '.git')));
    const legacyComparison = hasNestedRoot
      ? await compareLegacyTree(workspaceRoot, nestedRoot)
      : emptyLegacyComparison();
    const duplicateConfigs = hasNestedRoot
      ? await Promise.all(duplicateConfigFiles.map((fileName) => compareConfig(workspaceRoot, nestedRoot, fileName)))
      : [];

    const findings: StructureFinding[] = [];

    findings.push({
      id: 'canonical-root-selected',
      severity: hasRootMarkers ? 'INFO' : 'HIGH',
      category: 'canonical-root',
      action: hasRootMarkers ? 'keep' : 'review',
      title: hasRootMarkers ? 'Root workspace is the canonical product' : 'Canonical workspace markers are incomplete',
      detail: hasRootMarkers
        ? `The current root contains ${repoMarkers.join(', ')}, package ${rootPackage?.name ?? 'unknown'}, and the active Vite/Fastify app.`
        : 'The active workspace is missing one or more expected root markers.',
      path: '.',
      recommendation: hasRootMarkers
        ? 'Keep root-level frontend, backend, package manifests, docs, CI, and governance files as the active source of truth.'
        : 'Verify the active workspace before deleting or moving duplicated files.',
      blocksCleanup: !hasRootMarkers,
    });

    if (hasNestedRoot) {
      findings.push({
        id: 'legacy-migration-package',
        severity: hasNestedGit ? 'HIGH' : 'INFO',
        category: 'legacy-source',
        action: 'migrate',
        title: 'Legacy migration package is isolated',
        detail: hasNestedGit
          ? 'The legacy package still has nested .git metadata. Remove it or archive it outside the product before committing.'
          : 'Legacy source has been moved out of the active project shell and no longer creates a second runnable backend.',
        path: legacyRootRelativePath,
        recommendation:
          'Keep this folder only for bounded migrations. New product work belongs in root src, backend/src, docs, or .kiro.',
        blocksCleanup: hasNestedGit,
      });

      findings.push({
        id: 'two-backends-explained',
        severity: 'INFO',
        category: 'legacy-source',
        action: 'keep',
        title: 'Only one active backend remains',
        detail: 'backend/ is the active Fastify API. legacy/it-agentic-os/backend-src/ is migration material and is not runnable from root scripts.',
        path: 'backend, legacy/it-agentic-os/backend-src',
        recommendation: 'Build, test, and edit backend/src. Review legacy/it-agentic-os/backend-src only when migrating a specific capability.',
        blocksCleanup: false,
      });
    }

    if (legacyComparison.exactDuplicateCount > 0) {
      findings.push({
        id: 'legacy-exact-duplicates',
        severity: 'LOW',
        category: 'legacy-source',
        action: 'delete',
        title: 'Exact duplicate files exist in the legacy tree',
        detail: `${legacyComparison.exactDuplicateCount} legacy file(s) have identical content in the canonical root.`,
        path: legacyRootRelativePath,
        recommendation:
          'Remove exact duplicate legacy copies when a bounded migration confirms the root version is complete.',
        blocksCleanup: false,
      });
    }

    for (const duplicate of duplicateConfigs) {
      if (duplicate.status === 'different') {
        findings.push({
          id: `duplicate-${normalizeId(duplicate.fileName)}`,
          severity: 'MEDIUM',
          category: 'duplicate-config',
          action: 'migrate',
          title: `${duplicate.fileName} differs between root and legacy package`,
          detail: `${duplicate.rootPath} and ${duplicate.duplicatePath} are not identical.`,
          path: duplicate.duplicatePath,
          recommendation: duplicate.recommendation,
          blocksCleanup: true,
        });
      }
    }

    const generatedCandidates = [
      { path: 'dist', reason: 'Generated frontend build output; npm run build recreates it.' },
      { path: 'backend/dist', reason: 'Generated backend TypeScript output; backend build recreates it.' },
      { path: 'node_modules', reason: 'Installed dependencies; package-lock.json can restore it with npm install.' },
      { path: '.axon', reason: 'Local runtime/checkpoint state; keep locally but never commit.' },
      { path: '.idea', reason: 'IDE-local metadata; already ignored and safe to leave outside source control.' },
      { path: '.vscode', reason: 'Editor-local settings; already ignored and safe to leave outside source control.' },
    ];

    for (const candidate of generatedCandidates) {
      if (await exists(path.join(workspaceRoot, candidate.path))) {
        findings.push({
          id: `local-${normalizeId(candidate.path)}`,
          severity: candidate.path.includes('dist') ? 'LOW' : 'INFO',
          category: candidate.path.includes('dist') || candidate.path.includes('node_modules') ? 'generated-artifact' : 'local-state',
          action: candidate.path.includes('dist') ? 'delete' : 'ignore',
          title: `${candidate.path} is not canonical source`,
          detail: candidate.reason,
          path: candidate.path,
          recommendation: candidate.path.includes('dist')
            ? 'Do not hand-edit generated build output. Remove it only when you want a clean rebuild.'
            : 'Keep it out of Git and do not treat it as product source.',
          blocksCleanup: false,
        });
      }
    }

    const missingEnterpriseCapabilities = buildCapabilityGaps(findings);
    const score = calculateScore(findings, missingEnterpriseCapabilities.length);
    const blockers = findings.filter((finding) => finding.blocksCleanup && finding.severity !== 'INFO').length;

    return {
      id: `structure_${nanoid(10)}`,
      workspaceRoot,
      canonicalRoot: workspaceRoot,
      score,
      status: blockers > 0 ? 'blocked' : score >= 90 ? 'clean' : 'needs-review',
      summary: buildSummary(hasNestedRoot, blockers, score),
      validKeepPaths: [
        { path: 'src', reason: 'Canonical React product experience and route surfaces.', ownerAgent: 'FrontendExperienceAgent' },
        { path: 'backend/src', reason: 'Canonical Fastify API, agent services, safety gates, and product logic.', ownerAgent: 'PlatformBackendAgent' },
        { path: 'docs', reason: 'Architecture, product, operations, and governance evidence.', ownerAgent: 'DocumentationAgent' },
        { path: '.github', reason: 'Source control automation and CODEOWNERS governance.', ownerAgent: 'DevOpsAgent' },
        { path: '.kiro', reason: 'Spec/task planning context used by the product build process.', ownerAgent: 'DeliveryManagerAgent' },
        { path: legacyRootRelativePath, reason: 'Isolated legacy source package. Keep only for reviewed migration slices.', ownerAgent: 'RepoMigrationAgent' },
      ].filter((entry) => entry.path !== legacyRootRelativePath || hasNestedRoot),
      cleanupCandidates: findings
        .filter((finding) => ['delete', 'ignore', 'archive', 'migrate'].includes(finding.action))
        .map((finding) => ({
          path: finding.path ?? '.',
          action: finding.action,
          reason: finding.detail,
          safeCommand: buildSafeCommand(finding.path, finding.action),
        })),
      duplicateConfigs,
      legacyComparison,
      findings,
      migrationPlan: [
        {
          order: 1,
          ownerAgent: 'RepoGuardianAgent',
          action: 'Freeze the canonical root: root package.json, src, backend/src, docs, CI, and root config files are source of truth.',
          evidence: ['structure scan', 'package name', 'route/API registration'],
        },
        {
          order: 2,
          ownerAgent: 'RepoMigrationAgent',
          action: 'Diff legacy/it-agentic-os against root and migrate only missing useful components, docs, Kubernetes assets, and guidelines.',
          evidence: ['diff report', 'migrated file list', 'tests passing'],
        },
        {
          order: 3,
          ownerAgent: 'ConfigStewardAgent',
          action: 'Normalize duplicate .nvmrc, editorconfig, prettier, TypeScript, and Vite settings after migration decisions.',
          evidence: ['config comparison', 'format/typecheck output'],
        },
        {
          order: 4,
          ownerAgent: 'ReleaseSafetyAgent',
          action: 'Remove legacy/it-agentic-os after all useful modules are migrated and a checkpoint proves restore safety.',
          evidence: ['checkpoint id', 'approval record', 'restore instructions'],
        },
      ],
      missingEnterpriseCapabilities,
      createdAt: new Date().toISOString(),
    };
  }
}

async function compareLegacyTree(workspaceRoot: string, nestedRoot: string): Promise<LegacyComparison> {
  const [rootFiles, legacyFiles] = await Promise.all([
    collectFiles(workspaceRoot, workspaceRoot),
    collectFiles(nestedRoot, nestedRoot),
  ]);

  const rootScopedFiles = new Map(
    Array.from(rootFiles.entries()).filter(([relativePath]) => !relativePath.startsWith(`${legacyRootRelativePath}/`)),
  );

  const exactDuplicateFiles: LegacyComparison['exactDuplicateFiles'] = [];
  const driftedSharedFiles: LegacyComparison['driftedSharedFiles'] = [];
  const legacyOnlyFiles: LegacyComparison['legacyOnlyFiles'] = [];
  let rootOnlyCount = 0;

  for (const [relativePath, legacyFile] of legacyFiles) {
    const rootFile = rootScopedFiles.get(relativePath);
    if (!rootFile) {
      legacyOnlyFiles.push({
        path: relativePath,
        bytes: legacyFile.bytes,
        recommendation: 'Keep as migration material unless a root equivalent is intentionally created.',
      });
      continue;
    }

    if (rootFile.hash === legacyFile.hash) {
      exactDuplicateFiles.push({
        path: relativePath,
        bytes: legacyFile.bytes,
        recommendation: 'Safe duplicate candidate after confirming the legacy tree no longer needs to run standalone.',
      });
    } else {
      driftedSharedFiles.push({
        path: relativePath,
        rootBytes: rootFile.bytes,
        legacyBytes: legacyFile.bytes,
        recommendation: 'Review and migrate the better setting or implementation into the canonical root.',
      });
    }
  }

  for (const relativePath of rootScopedFiles.keys()) {
    if (!legacyFiles.has(relativePath)) rootOnlyCount += 1;
  }

  return {
    enabled: true,
    legacyRoot: legacyRootRelativePath,
    summary:
      legacyFiles.size === 0
        ? 'Legacy tree has no comparable source files after ignore rules.'
        : `Compared ${legacyFiles.size} legacy files against the canonical root: ${exactDuplicateFiles.length} exact duplicate(s), ${driftedSharedFiles.length} drifted shared file(s), ${legacyOnlyFiles.length} legacy-only file(s).`,
    exactDuplicateCount: exactDuplicateFiles.length,
    driftedSharedCount: driftedSharedFiles.length,
    legacyOnlyCount: legacyOnlyFiles.length,
    rootOnlyCount,
    ignoredDirectories: Array.from(ignoredComparisonDirs).sort(),
    exactDuplicateFiles: exactDuplicateFiles.slice(0, 50),
    driftedSharedFiles: driftedSharedFiles.slice(0, 80),
    legacyOnlyFiles: legacyOnlyFiles.slice(0, 80),
  };
}

async function collectFiles(root: string, current: string): Promise<Map<string, { fullPath: string; bytes: number; hash: string }>> {
  const entries = await readdir(current, { withFileTypes: true });
  const files = new Map<string, { fullPath: string; bytes: number; hash: string }>();

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredComparisonDirs.has(entry.name)) continue;
    const fullPath = path.join(current, entry.name);

    if (entry.isDirectory()) {
      const nested = await collectFiles(root, fullPath);
      for (const [relativePath, file] of nested) files.set(relativePath, file);
      continue;
    }

    if (!entry.isFile()) continue;
    const content = await readFile(fullPath);
    const relativePath = toPosix(path.relative(root, fullPath));
    files.set(relativePath, {
      fullPath,
      bytes: content.byteLength,
      hash: createHash('sha256').update(content).digest('hex'),
    });
  }

  return files;
}

function emptyLegacyComparison(): LegacyComparison {
  return {
    enabled: false,
    summary: 'No legacy migration package was included in this scan.',
    exactDuplicateCount: 0,
    driftedSharedCount: 0,
    legacyOnlyCount: 0,
    rootOnlyCount: 0,
    ignoredDirectories: Array.from(ignoredComparisonDirs).sort(),
    exactDuplicateFiles: [],
    driftedSharedFiles: [],
    legacyOnlyFiles: [],
  };
}

function resolveWorkspaceRoot(workspacePath?: string) {
  if (workspacePath) return path.resolve(workspacePath);
  const cwd = process.cwd();
  return path.basename(cwd).toLowerCase() === 'backend' ? path.resolve(cwd, '..') : cwd;
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function allExist(root: string, names: string[]) {
  const checks = await Promise.all(names.map((name) => exists(path.join(root, name))));
  return checks.every(Boolean);
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function compareConfig(workspaceRoot: string, nestedRoot: string, fileName: string): Promise<DuplicateConfig> {
  const rootPath = fileName;
  const duplicatePath = path.posix.join(legacyRootRelativePath, fileName);
  const rootFullPath = path.join(workspaceRoot, fileName);
  const duplicateFullPath = path.join(nestedRoot, fileName);
  const rootExists = await exists(rootFullPath);
  const duplicateExists = await exists(duplicateFullPath);

  if (!rootExists || !duplicateExists) {
    return {
      fileName,
      rootPath,
      duplicatePath,
      status: !rootExists ? 'missing-root' : 'missing-duplicate',
      recommendation: !rootExists
        ? `Migrate ${duplicatePath} to the canonical root only if it reflects the current product.`
        : `No nested duplicate found for ${fileName}.`,
    };
  }

  const [rootContent, duplicateContent] = await Promise.all([
    readFile(rootFullPath, 'utf8'),
    readFile(duplicateFullPath, 'utf8'),
  ]);

  return {
    fileName,
    rootPath,
    duplicatePath,
    status: rootContent === duplicateContent ? 'same' : 'different',
    recommendation:
      rootContent === duplicateContent
        ? `Keep root ${fileName}; legacy copy can be archived with the migration package.`
        : `Review differences and keep only settings required by the canonical root before archiving ${duplicatePath}.`,
  };
}

function buildCapabilityGaps(findings: StructureFinding[]) {
  const hasLegacyTree = findings.some((finding) => finding.id === 'nested-legacy-source');
  return [
    {
      id: 'repo-hygiene-gates',
      capability: 'Automated repository hygiene gates',
      whyItMatters: 'A 200k-person IT replacement cannot rely on humans remembering which folder is valid.',
      buildNext: 'Block release when duplicate roots, generated output, or unsafe local state enter the source path.',
    },
    {
      id: 'migration-diff-agent',
      capability: 'Legacy migration diff agent',
      whyItMatters: hasLegacyTree
        ? 'The nested source tree may contain useful assets, but deleting it blindly is risky.'
        : 'Future imports need repeatable migration decisions.',
      buildNext: 'Add a scoped diff worker that proposes exact file moves, tests, and archive checkpoints.',
    },
    {
      id: 'workspace-contract',
      capability: 'Workspace contract as policy',
      whyItMatters: 'Enterprise teams need a machine-readable contract for canonical paths, owners, and forbidden artifacts.',
      buildNext: 'Persist structure policy in docs/project-structure.md and expose it in CI.',
    },
    {
      id: 'preview-runtime',
      capability: 'User-facing app preview runtime',
      whyItMatters: 'Product confidence comes from seeing the generated app running immediately.',
      buildNext: 'Connect Build Studio blueprints to ephemeral preview environments with logs, URL, and rollback.',
    },
  ];
}

function calculateScore(findings: StructureFinding[], gapCount: number) {
  const penalty = findings.reduce((total, finding) => {
    if (finding.severity === 'CRITICAL') return total + 35;
    if (finding.severity === 'HIGH') return total + 22;
    if (finding.severity === 'MEDIUM') return total + 10;
    if (finding.severity === 'LOW') return total + 3;
    return total;
  }, gapCount * 2);
  return Math.max(0, Math.min(100, 100 - penalty));
}

function buildSummary(hasNestedRoot: boolean, blockers: number, score: number) {
  if (hasNestedRoot) {
    return `Canonical root is clean and the legacy migration package is isolated under ${legacyRootRelativePath}. Structure score: ${score}%.`;
  }
  if (blockers > 0) return `Workspace needs owner review before cleanup. Structure score: ${score}%.`;
  return `Workspace structure is clean enough for enterprise delivery. Structure score: ${score}%.`;
}

function buildSafeCommand(relativePath: string | undefined, action: string) {
  if (!relativePath || action !== 'delete') return undefined;
  if (!relativePath.includes('dist')) return undefined;
  return `Remove-Item -LiteralPath "${relativePath}" -Recurse -Force`;
}

function normalizeId(value: string) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

function toPosix(value: string) {
  return value.split(path.sep).join('/');
}

export const structureGuardian = new StructureGuardianService();
