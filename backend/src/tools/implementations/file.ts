import { readFile, writeFile, readdir, stat, mkdir, unlink } from 'node:fs/promises';
import type { ToolHandler } from '../registry.js';
import type { ToolExecutionRequest, ToolExecutionResult, SandboxConfig } from '../types.js';
import { safeJoin } from '../safety/sandbox-fs.js';

/**
 * File tool — read/write/list/stat/mkdir/delete inside the sandbox.
 *
 * All paths are resolved through safeJoin which refuses traversal outside
 * the task-scoped sandbox directory. Binary write sizes are capped to prevent
 * a runaway agent from filling the disk.
 */

const MAX_WRITE_BYTES = 8 * 1024 * 1024;
const SAFE_ENCODINGS: BufferEncoding[] = ['utf-8', 'utf8', 'ascii', 'base64', 'hex'];

export const fileTool: ToolHandler = {
  definition: {
    name: 'file.operations',
    category: 'file',
    description: 'Read/write/list/stat/mkdir/delete files within the per-task sandbox directory.',
    parameters: [
      { name: 'operation', type: 'string', required: true, description: 'read | write | list | stat | mkdir | delete' },
      { name: 'path', type: 'string', required: true, description: 'Path relative to the task sandbox' },
      { name: 'content', type: 'string', required: false, description: 'Content for write (max 8MB)' },
      { name: 'encoding', type: 'string', required: false, description: 'File encoding (utf-8, base64, hex, ascii)', default: 'utf-8' },
    ],
    requiresApproval: false,
    riskLevel: 'medium',
    timeout: 10000,
  },

  async execute(request: ToolExecutionRequest, sandbox: SandboxConfig): Promise<ToolExecutionResult> {
    const { operation, path: filePath, content, encoding = 'utf-8' } = request.parameters as {
      operation: string; path: string; content?: string; encoding?: BufferEncoding;
    };

    if (!SAFE_ENCODINGS.includes(encoding)) {
      return { success: false, output: `Unsupported encoding: ${encoding}`, durationMs: 0 };
    }

    const baseDir = sandbox.workingDirectory;
    if (!baseDir) {
      return { success: false, output: 'Sandbox workingDirectory is not configured', durationMs: 0 };
    }

    let resolvedPath: string;
    try {
      resolvedPath = safeJoin(baseDir, filePath);
    } catch (err) {
      return { success: false, output: (err as Error).message, durationMs: 0 };
    }

    const start = Date.now();

    try {
      switch (operation) {
        case 'read': {
          const data = await readFile(resolvedPath, { encoding });
          return { success: true, output: { content: data, path: resolvedPath, size: data.length }, durationMs: Date.now() - start };
        }
        case 'write': {
          if (content === undefined) return { success: false, output: 'Content required for write', durationMs: 0 };
          const byteLength = Buffer.byteLength(content, encoding);
          if (byteLength > MAX_WRITE_BYTES) {
            return { success: false, output: `Write exceeds ${MAX_WRITE_BYTES} bytes`, durationMs: 0 };
          }
          await mkdir(safeJoin(baseDir, filePath.split(/[\\/]/).slice(0, -1).join('/') || '.'), { recursive: true });
          await writeFile(resolvedPath, content, { encoding });
          return { success: true, output: { path: resolvedPath, bytesWritten: byteLength }, durationMs: Date.now() - start, sideEffects: ['file_written'] };
        }
        case 'list': {
          const entries = await readdir(resolvedPath, { withFileTypes: true });
          const files = entries.map((e) => ({ name: e.name, type: e.isDirectory() ? 'directory' : 'file' }));
          return { success: true, output: { path: resolvedPath, entries: files, count: files.length }, durationMs: Date.now() - start };
        }
        case 'stat': {
          const info = await stat(resolvedPath);
          return { success: true, output: { path: resolvedPath, size: info.size, isFile: info.isFile(), isDirectory: info.isDirectory(), modified: info.mtime.toISOString(), created: info.birthtime.toISOString() }, durationMs: Date.now() - start };
        }
        case 'mkdir': {
          await mkdir(resolvedPath, { recursive: true });
          return { success: true, output: { path: resolvedPath, created: true }, durationMs: Date.now() - start, sideEffects: ['directory_created'] };
        }
        case 'delete': {
          await unlink(resolvedPath);
          return { success: true, output: { path: resolvedPath, deleted: true }, durationMs: Date.now() - start, sideEffects: ['file_deleted'] };
        }
        default:
          return { success: false, output: `Unknown operation: ${operation}`, durationMs: 0 };
      }
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      return { success: false, output: `${error.code || 'ERROR'}: ${error.message}`, durationMs: Date.now() - start };
    }
  },
};
