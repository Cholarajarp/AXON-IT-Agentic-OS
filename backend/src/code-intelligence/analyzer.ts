/**
 * Dependency Analyzer Implementation
 * Analyzes file dependencies and detects circular dependencies
 */

import type { IDependencyAnalyzer, ASTNode } from './types.js';
import { codeIndexStore } from './store.js';

/**
 * Dependency Analyzer
 * Analyzes import/export relationships and builds dependency graphs
 */
export class DependencyAnalyzer implements IDependencyAnalyzer {
  /**
   * Analyze file dependencies from AST
   */
  async analyzeDependencies(filePath: string, ast: ASTNode): Promise<string[]> {
    const imports = new Set<string>();
    const source = ast.text;
    const language = this.detectLanguage(filePath);

    for (const pattern of this.getImportPatterns(language)) {
      for (const match of source.matchAll(pattern)) {
        const value = match[1]?.trim();
        if (value) {
          imports.add(this.resolveImportPath(filePath, value));
        }
      }
    }

    if (language === 'python') {
      for (const match of source.matchAll(/^\s*import\s+([^\n#]+)/gm)) {
        for (const part of match[1]?.split(',') ?? []) {
          const value = part.trim().split(/\s+as\s+/i)[0];
          if (value) {
            imports.add(value);
          }
        }
      }
    }

    if (language === 'go') {
      for (const block of source.matchAll(/import\s*\(([\s\S]*?)\)/g)) {
        for (const match of block[1]?.matchAll(/"([^"]+)"/g) ?? []) {
          if (match[1]) {
            imports.add(match[1]);
          }
        }
      }
    }

    return Array.from(imports).sort();
  }

  /**
   * Build dependency graph for entire workspace
   */
  async buildDependencyGraph(workspaceId: string): Promise<Map<string, string[]>> {
    return new Map(
      codeIndexStore
        .getFiles(workspaceId)
        .map((file) => [file.filePath, file.dependencies])
    );
  }

  /**
   * Detect circular dependencies using DFS
   */
  detectCircularDependencies(graph: Map<string, string[]>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const currentPath: string[] = [];

    const dfs = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);
      currentPath.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = currentPath.indexOf(neighbor);
          const cycle = currentPath.slice(cycleStart);
          cycles.push([...cycle, neighbor]);
          return true;
        }
      }

      recursionStack.delete(node);
      currentPath.pop();
      return false;
    };

    // Check all nodes for cycles
    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  /**
   * Extract import path from import statement
   */
  protected extractImportPath(importNode: ASTNode): string | null {
    return (
      this.getImportPatterns('typescript')
        .map((pattern) => pattern.exec(importNode.text)?.[1] ?? null)
        .find((value): value is string => Boolean(value)) ?? null
    );
  }

  /**
   * Resolve relative import path to absolute path
   */
  protected resolveImportPath(_currentFilePath: string, importPath: string): string {
    return importPath;
  }

  /**
   * Check if import is external (node_modules)
   */
  protected isExternalImport(importPath: string): boolean {
    return !importPath.startsWith('.') && !importPath.startsWith('/');
  }

  private detectLanguage(filePath: string): string {
    const lower = filePath.toLowerCase();
    if (/\.(ts|tsx)$/.test(lower)) return 'typescript';
    if (/\.(js|jsx|mjs|cjs)$/.test(lower)) return 'javascript';
    if (lower.endsWith('.py')) return 'python';
    if (lower.endsWith('.java')) return 'java';
    if (lower.endsWith('.go')) return 'go';
    if (lower.endsWith('.rs')) return 'rust';
    if (/\.(c|cc|cpp|cxx|h|hpp)$/.test(lower)) return 'cpp';
    return 'unknown';
  }

  private getImportPatterns(language: string): RegExp[] {
    if (language === 'typescript' || language === 'javascript') {
      return [
        /^\s*import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/gm,
        /^\s*export\s+[\s\S]*?\s+from\s+["']([^"']+)["']/gm,
        /\brequire\(\s*["']([^"']+)["']\s*\)/g,
        /\bimport\(\s*["']([^"']+)["']\s*\)/g,
      ];
    }

    if (language === 'python') {
      return [/^\s*from\s+([\w.]+)\s+import\s+/gm];
    }

    if (language === 'java') {
      return [/^\s*import\s+([\w.*]+)\s*;/gm];
    }

    if (language === 'go') {
      return [/^\s*import\s+(?:\w+\s+)?["']([^"']+)["']/gm];
    }

    if (language === 'rust') {
      return [/^\s*use\s+([^;]+);/gm, /^\s*mod\s+(\w+)\s*;/gm, /^\s*extern\s+crate\s+(\w+)\s*;/gm];
    }

    if (language === 'cpp') {
      return [/^\s*#\s*include\s+[<"]([^>"]+)[>"]/gm];
    }

    return [];
  }
}

/**
 * Create a new dependency analyzer instance
 */
export function createDependencyAnalyzer(): IDependencyAnalyzer {
  return new DependencyAnalyzer();
}
