import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const stateRoot = resolve(process.cwd(), process.env.AXON_STATE_DIR ?? '.axon/state');
const disabled = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

export class DurableJsonStore<T> {
  private readonly path: string;

  constructor(relativePath: string, private readonly fallback: T) {
    this.path = resolve(stateRoot, relativePath);
  }

  read(): T {
    if (disabled || !existsSync(this.path)) return this.fallback;
    try {
      return JSON.parse(readFileSync(this.path, 'utf8')) as T;
    } catch {
      return this.fallback;
    }
  }

  write(value: T): void {
    if (disabled) return;
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
    writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
    try {
      replaceWithRetry(tmp, this.path);
    } catch (error) {
      rmSync(tmp, { force: true });
      throw error;
    }
  }
}

function replaceWithRetry(tmp: string, target: string): void {
  const attempts = 8;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      renameSync(tmp, target);
      return;
    } catch (error) {
      if (attempt === attempts - 1 || !isRetryableFsError(error)) throw error;
      sleep(25 * (attempt + 1));
    }
  }
}

function isRetryableFsError(error: unknown): boolean {
  return Boolean(
    error
      && typeof error === 'object'
      && 'code' in error
      && ['EPERM', 'EBUSY', 'EACCES', 'EEXIST'].includes(String((error as { code?: unknown }).code)),
  );
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
