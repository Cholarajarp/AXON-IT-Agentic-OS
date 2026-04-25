import type { IndexedFile, IndexError, Symbol, SupportedLanguage } from './types.js';

export interface IndexedCodeFile extends IndexedFile {
  content: string;
  symbols: Symbol[];
  dependencies: string[];
}

export class CodeIndexStore {
  private workspaces = new Map<string, Map<string, IndexedCodeFile>>();
  private errors = new Map<string, IndexError[]>();
  private inProgress = new Set<string>();
  private lastIndexedAt = new Map<string, Date>();

  startWorkspace(workspaceId: string): void {
    this.inProgress.add(workspaceId);
    this.errors.set(workspaceId, []);
  }

  finishWorkspace(workspaceId: string): void {
    this.inProgress.delete(workspaceId);
    this.lastIndexedAt.set(workspaceId, new Date());
  }

  clearWorkspace(workspaceId: string): void {
    this.workspaces.set(workspaceId, new Map());
    this.errors.set(workspaceId, []);
  }

  addError(workspaceId: string, error: IndexError): void {
    const errors = this.errors.get(workspaceId) ?? [];
    errors.push(error);
    this.errors.set(workspaceId, errors);
  }

  upsertFile(file: IndexedCodeFile): void {
    const files = this.workspaces.get(file.workspaceId) ?? new Map<string, IndexedCodeFile>();
    files.set(file.filePath, file);
    this.workspaces.set(file.workspaceId, files);
  }

  removeFile(workspaceId: string, filePath: string): void {
    this.workspaces.get(workspaceId)?.delete(filePath);
  }

  getFile(workspaceId: string, filePath: string): IndexedCodeFile | undefined {
    return this.workspaces.get(workspaceId)?.get(filePath);
  }

  getFiles(workspaceId: string): IndexedCodeFile[] {
    return Array.from(this.workspaces.get(workspaceId)?.values() ?? []);
  }

  getSymbols(workspaceId: string): Symbol[] {
    return this.getFiles(workspaceId).flatMap((file) => file.symbols);
  }

  getStatus(workspaceId: string) {
    const files = this.getFiles(workspaceId);
    return {
      workspaceId,
      totalFiles: files.length,
      indexedFiles: files.length,
      inProgress: this.inProgress.has(workspaceId),
      lastIndexedAt: this.lastIndexedAt.get(workspaceId),
      errors: this.errors.get(workspaceId) ?? [],
    };
  }

  getLanguageStats(workspaceId: string): Record<SupportedLanguage, number> {
    const stats = {
      typescript: 0,
      javascript: 0,
      python: 0,
      java: 0,
      go: 0,
      rust: 0,
      cpp: 0,
    } satisfies Record<SupportedLanguage, number>;

    for (const file of this.getFiles(workspaceId)) {
      stats[file.language] += 1;
    }

    return stats;
  }
}

export const codeIndexStore = new CodeIndexStore();
