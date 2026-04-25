import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
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
    const tmp = `${this.path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
    renameSync(tmp, this.path);
  }
}
