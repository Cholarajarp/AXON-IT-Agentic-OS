import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { nanoid } from 'nanoid';
import { DurableJsonStore } from '../services/durable-json-store.js';
import type { ArtifactInput, ArtifactRecord, ArtifactStoreHealth } from './types.js';

const testRuntime = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
const artifactRoot = testRuntime
  ? join(tmpdir(), `axon-artifacts-${process.pid}`)
  : resolve(process.cwd(), process.env.AXON_ARTIFACT_DIR ?? '.axon/artifacts');
const manifestStore = new DurableJsonStore<ArtifactRecord[]>('artifact-manifest.json', []);
const records: ArtifactRecord[] = manifestStore.read();

export class ArtifactService {
  list(input: { tenantId?: string; kind?: string; limit?: number } = {}): ArtifactRecord[] {
    return records
      .filter((record) => !input.tenantId || record.tenantId === input.tenantId)
      .filter((record) => !input.kind || record.kind === input.kind)
      .slice(-(input.limit ?? 200))
      .reverse();
  }

  get(id: string): ArtifactRecord | undefined {
    return records.find((record) => record.id === id);
  }

  readContent(id: string): string | undefined {
    const record = this.get(id);
    if (!record || !record.uri.startsWith('file://')) return undefined;
    const path = record.uri.replace(/^file:\/\//, '');
    if (!existsSync(path)) return undefined;
    return readFileSync(path, 'utf8');
  }

  put(input: ArtifactInput): ArtifactRecord {
    const tenantId = input.tenantId ?? 'tenant_default';
    const serialized = typeof input.content === 'string' ? input.content : JSON.stringify(input.content, null, 2);
    const bytes = Buffer.byteLength(serialized);
    const sha256 = createHash('sha256').update(serialized).digest('hex');
    const id = `art_${nanoid(10)}`;
    const ext = contentExt(input.contentType ?? (typeof input.content === 'string' ? 'text/plain' : 'application/json'));
    const tenantDir = join(artifactRoot, safeSegment(tenantId));
    mkdirSync(tenantDir, { recursive: true });
    const path = join(tenantDir, `${id}${ext}`);
    writeFileSync(path, serialized, 'utf8');

    const record: ArtifactRecord = {
      id,
      tenantId,
      kind: input.kind,
      name: input.name,
      uri: `file://${path}`,
      sha256,
      bytes,
      contentType: input.contentType ?? (typeof input.content === 'string' ? 'text/plain' : 'application/json'),
      metadata: input.metadata ?? {},
      createdAt: new Date().toISOString(),
    };
    records.push(record);
    manifestStore.write(records);
    return record;
  }

  health(): ArtifactStoreHealth {
    const warnings: string[] = [];
    const driver = process.env.AXON_ARTIFACT_DRIVER === 's3' ? 's3-compatible' : 'local';
    if (driver === 'local' && process.env.NODE_ENV === 'production') {
      warnings.push('Local artifact storage is not suitable for multi-node production. Configure S3-compatible object storage.');
    }
    if (driver === 's3-compatible' && !process.env.AXON_S3_BUCKET) {
      warnings.push('AXON_ARTIFACT_DRIVER=s3 requires AXON_S3_BUCKET before external production launch.');
    }

    let writable = false;
    try {
      mkdirSync(artifactRoot, { recursive: true });
      const probePath = join(artifactRoot, `.health-${process.pid}.json`);
      writeFileSync(probePath, JSON.stringify({ ok: true, at: new Date().toISOString() }), 'utf8');
      writable = true;
    } catch {
      writable = false;
      warnings.push('Artifact root is not writable.');
    }

    return {
      driver,
      writable,
      root: artifactRoot,
      mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      warnings,
    };
  }
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 80) || 'tenant_default';
}

function contentExt(contentType: string): string {
  if (contentType.includes('json')) return '.json';
  if (contentType.includes('html')) return '.html';
  if (contentType.includes('markdown')) return '.md';
  return '.txt';
}

export const artifactService = new ArtifactService();
