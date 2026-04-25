import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type {
  CheckpointArtifact,
  CheckpointInput,
  ProjectCheckpoint,
  RollbackPreview,
} from './types.js';

const checkpoints = new Map<string, ProjectCheckpoint>();
const defaultIncludePaths = [
  'package.json',
  'backend/package.json',
  'src/app/routes.tsx',
  'src/app/lib/queries.ts',
  'backend/src/index.ts',
  '.kiro/specs/competitive-ai-coding-platform-enhancements/tasks.md',
];

const ignoredDirs = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.cache', '.axon']);

export class CheckpointService {
  async create(input: CheckpointInput): Promise<ProjectCheckpoint> {
    const root = workspaceRoot();
    const includePaths = input.includePaths?.length ? input.includePaths : defaultIncludePaths;
    const artifacts = await collectArtifacts(root, includePaths);
    const now = new Date().toISOString();
    const checkpoint: ProjectCheckpoint = {
      id: `chk_${nanoid(10)}`,
      name: input.name.trim(),
      description: input.description?.trim() || 'AXON autonomous build checkpoint',
      scope: input.scope ?? 'workspace',
      status: 'created',
      workflowId: input.workflowId,
      blueprintId: input.blueprintId,
      artifacts,
      metadata: {
        agentContext: 'checkpoint captures file hashes, build scope, and launch evidence pointers',
        restoreMode: 'non-destructive-preview',
        ...(input.metadata ?? {}),
      },
      costUsd: estimateCheckpointCost(artifacts),
      createdAt: now,
      updatedAt: now,
    };
    checkpoints.set(checkpoint.id, checkpoint);
    return checkpoint;
  }

  list(): ProjectCheckpoint[] {
    return Array.from(checkpoints.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): ProjectCheckpoint | undefined {
    return checkpoints.get(id);
  }

  async previewRollback(id: string): Promise<RollbackPreview | undefined> {
    const checkpoint = checkpoints.get(id);
    if (!checkpoint) return undefined;

    const root = workspaceRoot();
    const impactedArtifacts = await Promise.all(
      checkpoint.artifacts.map(async (artifact) => {
        const absolute = resolveInside(root, artifact.path);
        const content = await readFile(absolute).catch(() => undefined);
        const currentHash = content ? sha256(content) : undefined;
        return {
          path: artifact.path,
          checkpointHash: artifact.hash,
          currentHash,
          state: !currentHash ? 'missing' as const : currentHash === artifact.hash ? 'unchanged' as const : 'changed' as const,
        };
      }),
    );

    const changed = impactedArtifacts.filter((artifact) => artifact.state !== 'unchanged');
    const requiredApprovals = [
      'Human operator approval',
      checkpoint.scope === 'database' ? 'Database owner approval' : undefined,
      checkpoint.scope === 'deployment' ? 'Release owner approval' : undefined,
    ].filter(Boolean) as string[];
    const warnings = [
      'Rollback is preview-only in this version; no files are modified by this API.',
      changed.length > 0 ? `${changed.length} artifact(s) differ from checkpoint state.` : undefined,
      checkpoint.scope === 'database' ? 'Production database restore must use point-in-time recovery, not file rollback.' : undefined,
    ].filter(Boolean) as string[];

    checkpoint.status = 'restore-previewed';
    checkpoint.updatedAt = new Date().toISOString();

    return {
      checkpointId: checkpoint.id,
      safeToRestore: checkpoint.scope !== 'database' && checkpoint.scope !== 'deployment',
      summary: changed.length === 0
        ? 'Current workspace matches this checkpoint for tracked artifacts.'
        : 'Rollback preview is ready. Review changed artifacts before approving any restore.',
      impactedArtifacts,
      requiredApprovals,
      warnings,
      nextSteps: [
        'Review changed artifacts and open diffs in Code Intelligence.',
        'Confirm database and deployment scope before restore.',
        'Create a new checkpoint before any destructive restore action.',
        'Attach rollback preview to Evidence for audit trail.',
      ],
    };
  }

  markRestored(id: string): ProjectCheckpoint | undefined {
    const checkpoint = checkpoints.get(id);
    if (!checkpoint) return undefined;
    checkpoint.status = 'restore-marked';
    checkpoint.updatedAt = new Date().toISOString();
    checkpoint.metadata = {
      ...checkpoint.metadata,
      restoreMarkedAt: checkpoint.updatedAt,
      restoreNote: 'Restore was marked in AXON. This API does not mutate workspace files.',
    };
    return checkpoint;
  }

  seedIfEmpty() {
    if (checkpoints.size > 0) return;
    const now = new Date().toISOString();
    const starter: ProjectCheckpoint = {
      id: 'chk_enterprise_baseline',
      name: 'Enterprise baseline',
      description: 'Baseline after Build Studio, Database Pipeline, Enterprise OS, and Security Center were added.',
      scope: 'workspace',
      status: 'created',
      artifacts: [],
      metadata: {
        restoreMode: 'non-destructive-preview',
        source: 'system-seed',
      },
      costUsd: 0,
      createdAt: now,
      updatedAt: now,
    };
    checkpoints.set(starter.id, starter);
  }
}

async function collectArtifacts(root: string, includePaths: string[]): Promise<CheckpointArtifact[]> {
  const expanded = new Set<string>();
  for (const includePath of includePaths) {
    const absolute = resolveInside(root, includePath);
    const info = await stat(absolute).catch(() => undefined);
    if (!info) continue;
    if (info.isDirectory()) {
      for (const file of await walk(absolute, root, 40)) expanded.add(file);
    } else if (info.isFile()) {
      expanded.add(includePath.replace(/\\/g, '/'));
    }
  }

  const artifacts: CheckpointArtifact[] = [];
  for (const relativePath of expanded) {
    const absolute = resolveInside(root, relativePath);
    const content = await readFile(absolute).catch(() => undefined);
    if (!content) continue;
    artifacts.push({
      path: relativePath,
      hash: sha256(content),
      bytes: content.byteLength,
      kind: classifyArtifact(relativePath),
    });
  }
  return artifacts.sort((a, b) => a.path.localeCompare(b.path));
}

async function walk(directory: string, root: string, remaining: number): Promise<string[]> {
  if (remaining <= 0) return [];
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    if (files.length >= remaining) break;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) files.push(...await walk(absolute, root, remaining - files.length));
    } else if (entry.isFile()) {
      const info = await stat(absolute).catch(() => undefined);
      if (info && info.size <= 256_000) files.push(path.relative(root, absolute).replace(/\\/g, '/'));
    }
  }
  return files.slice(0, remaining);
}

function workspaceRoot() {
  const cwd = process.cwd();
  return path.basename(cwd) === 'backend' ? path.resolve(cwd, '..') : cwd;
}

function resolveInside(root: string, relativePath: string) {
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(root)) throw new Error('Checkpoint path must stay inside workspace');
  return resolved;
}

function sha256(content: Buffer | string) {
  return createHash('sha256').update(content).digest('hex');
}

function classifyArtifact(relativePath: string): CheckpointArtifact['kind'] {
  if (/database|migration|schema|\.sql$/i.test(relativePath)) return 'database';
  if (/evidence|audit|security/i.test(relativePath)) return 'evidence';
  if (/package|config|\.json$|\.ya?ml$/i.test(relativePath)) return 'config';
  if (/preview|build-studio|blueprint/i.test(relativePath)) return 'preview';
  return 'file';
}

function estimateCheckpointCost(artifacts: CheckpointArtifact[]) {
  const bytes = artifacts.reduce((total, artifact) => total + artifact.bytes, 0);
  return Number(Math.max(0.001, bytes / 1024 / 1024 * 0.002).toFixed(4));
}

export const checkpointService = new CheckpointService();
