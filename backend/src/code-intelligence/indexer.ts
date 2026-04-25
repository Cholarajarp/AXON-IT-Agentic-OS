/**
 * Workspace Indexer Implementation
 * Indexes codebases for fast search and analysis
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { IndexError, IndexResult, IndexStatus, IWorkspaceIndexer } from './types.js';
import { createDependencyAnalyzer } from './analyzer.js';
import { createSymbolExtractor } from './extractor.js';
import { createASTParser } from './parser.js';
import { codeIndexStore } from './store.js';

/**
 * Workspace Indexer
 * Scans directories, parses files, and builds searchable index.
 */
export class WorkspaceIndexer implements IWorkspaceIndexer {
  private parser = createASTParser();
  private extractor = createSymbolExtractor();
  private analyzer = createDependencyAnalyzer();

  /**
   * Index entire workspace
   */
  async indexWorkspace(workspacePath: string, workspaceId: string): Promise<IndexResult> {
    const startTime = Date.now();
    const errors: IndexError[] = [];
    let filesIndexed = 0;
    let symbolsExtracted = 0;

    codeIndexStore.startWorkspace(workspaceId);
    codeIndexStore.clearWorkspace(workspaceId);

    try {
      const root = path.resolve(workspacePath);
      const ignorePatterns = await this.loadIgnorePatterns(root);
      const filePaths = await this.scanWorkspace(root, root, ignorePatterns);

      for (const absolutePath of filePaths) {
        try {
          const relativePath = this.toWorkspacePath(root, absolutePath);
          const content = await fs.readFile(absolutePath, 'utf8');
          const stat = await fs.stat(absolutePath);
          const language = this.parser.detectLanguage(absolutePath);

          if (!language) continue;

          const ast = await this.parser.parse(content, language);
          const symbols = await this.extractor.extractSymbols(ast, relativePath);
          const dependencies = await this.analyzer.analyzeDependencies(relativePath, ast);

          codeIndexStore.upsertFile({
            id: this.createFileId(workspaceId, relativePath),
            workspaceId,
            filePath: relativePath,
            language,
            contentHash: this.calculateHash(content),
            sizeBytes: Buffer.byteLength(content),
            lastModified: stat.mtime,
            indexedAt: new Date(),
            content,
            symbols,
            dependencies,
          });

          filesIndexed += 1;
          symbolsExtracted += symbols.length;
        } catch (error) {
          const indexError = {
            filePath: absolutePath,
            error: error instanceof Error ? error.message : String(error),
          };
          errors.push(indexError);
          codeIndexStore.addError(workspaceId, indexError);
        }
      }
    } catch (error) {
      const indexError = {
        filePath: workspacePath,
        error: error instanceof Error ? error.message : String(error),
      };
      errors.push(indexError);
      codeIndexStore.addError(workspaceId, indexError);
    } finally {
      codeIndexStore.finishWorkspace(workspaceId);
    }

    const durationMs = Date.now() - startTime;

    return {
      filesIndexed,
      symbolsExtracted,
      durationMs,
      errors,
    };
  }

  /**
   * Update index for a single file
   */
  async updateFile(filePath: string, content: string, workspaceId: string): Promise<void> {
    const language = this.parser.detectLanguage(filePath);
    if (!language) {
      throw new Error(`Unsupported file type: ${filePath}`);
    }

    const ast = await this.parser.parse(content, language);
    const symbols = await this.extractor.extractSymbols(ast, filePath);
    const dependencies = await this.analyzer.analyzeDependencies(filePath, ast);

    codeIndexStore.upsertFile({
      id: this.createFileId(workspaceId, filePath),
      workspaceId,
      filePath,
      language,
      contentHash: this.calculateHash(content),
      sizeBytes: Buffer.byteLength(content),
      lastModified: new Date(),
      indexedAt: new Date(),
      content,
      symbols,
      dependencies,
    });
  }

  /**
   * Remove file from index
   */
  async removeFile(filePath: string, workspaceId: string): Promise<void> {
    codeIndexStore.removeFile(workspaceId, filePath);
  }

  /**
   * Get indexing status
   */
  async getStatus(workspaceId: string): Promise<IndexStatus> {
    return codeIndexStore.getStatus(workspaceId);
  }

  /**
   * Check if file should be indexed
   */
  protected shouldIndexFile(filePath: string): boolean {
    const language = this.parser.detectLanguage(filePath);
    return language !== null;
  }

  private calculateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private createFileId(workspaceId: string, filePath: string): string {
    return createHash('sha256').update(`${workspaceId}:${filePath}`).digest('hex');
  }

  private async loadIgnorePatterns(workspaceRoot: string): Promise<string[]> {
    try {
      const raw = await fs.readFile(path.join(workspaceRoot, '.gitignore'), 'utf8');
      return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && !line.startsWith('!'));
    } catch {
      return [];
    }
  }

  private async scanWorkspace(
    workspaceRoot: string,
    directory: string,
    ignorePatterns: string[]
  ): Promise<string[]> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = this.toWorkspacePath(workspaceRoot, absolutePath);

      if (entry.isDirectory()) {
        if (
          this.shouldSkipDirectory(entry.name) ||
          this.matchesIgnore(relativePath, ignorePatterns)
        ) {
          continue;
        }

        files.push(...(await this.scanWorkspace(workspaceRoot, absolutePath, ignorePatterns)));
        continue;
      }

      if (!entry.isFile()) continue;
      if (this.matchesIgnore(relativePath, ignorePatterns)) continue;
      if (!this.shouldIndexFile(absolutePath)) continue;

      const stat = await fs.stat(absolutePath);
      if (stat.size > 1_500_000) continue;

      files.push(absolutePath);
    }

    return files;
  }

  private shouldSkipDirectory(name: string): boolean {
    return [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      '.next',
      '.nuxt',
      'target',
      'bin',
      'obj',
      '.idea',
      '.vscode',
    ].includes(name);
  }

  private matchesIgnore(relativePath: string, patterns: string[]): boolean {
    const normalized = relativePath.replace(/\\/g, '/');

    return patterns.some((pattern) => {
      const clean = pattern.replace(/\\/g, '/').replace(/^\//, '');

      if (!clean) return false;
      if (clean.endsWith('/')) {
        return normalized === clean.slice(0, -1) || normalized.startsWith(clean);
      }
      if (clean.includes('*')) {
        const regex = new RegExp(`^${clean.split('*').map(this.escapeRegex).join('.*')}$`);
        return regex.test(normalized) || regex.test(path.basename(normalized));
      }

      return (
        normalized === clean ||
        normalized.startsWith(`${clean}/`) ||
        path.basename(normalized) === clean
      );
    });
  }

  private escapeRegex(value: string): string {
    return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  }

  private toWorkspacePath(workspaceRoot: string, absolutePath: string): string {
    return path.relative(workspaceRoot, absolutePath).replace(/\\/g, '/');
  }
}

/**
 * Create a new workspace indexer instance
 */
export function createWorkspaceIndexer(): IWorkspaceIndexer {
  return new WorkspaceIndexer();
}
