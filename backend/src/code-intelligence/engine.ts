/**
 * Code Intelligence Engine Implementation
 * Orchestrates all code understanding capabilities
 */

import type {
  Definition,
  FileAnalysis,
  ICodeIntelligenceEngine,
  IndexResult,
  IndexStatus,
  Pattern,
  Reference,
  SearchOptions,
  SearchResult,
  Symbol as CodeSymbol,
  SymbolEdge,
  SymbolGraph,
  UnusedCode,
} from './types.js';
import { createDependencyAnalyzer } from './analyzer.js';
import { createWorkspaceIndexer } from './indexer.js';
import { createASTParser } from './parser.js';
import { codeIndexStore, type IndexedCodeFile } from './store.js';

/**
 * Code Intelligence Engine
 * Provides deep code understanding through indexing, symbol extraction, and search.
 */
export class CodeIntelligenceEngine implements ICodeIntelligenceEngine {
  private indexer = createWorkspaceIndexer();
  private parser = createASTParser();
  private analyzer = createDependencyAnalyzer();

  async indexWorkspace(workspacePath: string, workspaceId: string): Promise<IndexResult> {
    return this.indexer.indexWorkspace(workspacePath, workspaceId);
  }

  async updateFile(filePath: string, content: string, workspaceId: string): Promise<void> {
    return this.indexer.updateFile(filePath, content, workspaceId);
  }

  async removeFile(filePath: string, workspaceId: string): Promise<void> {
    return this.indexer.removeFile(filePath, workspaceId);
  }

  async getStatus(workspaceId: string): Promise<IndexStatus> {
    return this.indexer.getStatus(workspaceId);
  }

  async searchCode(
    query: string,
    workspaceId: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const terms = this.tokenize(query);
    const exact = query.trim().toLowerCase();
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);
    const results = new Map<string, SearchResult>();

    for (const file of this.filterFiles(codeIndexStore.getFiles(workspaceId), options)) {
      const lines = file.content.split(/\r?\n/);

      lines.forEach((line, index) => {
        const lineLower = line.toLowerCase();
        const score = this.scoreText(lineLower, terms, exact);
        if (score <= 0) return;

        const key = `${file.filePath}:${index + 1}`;
        results.set(key, {
          filePath: file.filePath,
          line: index + 1,
          column: Math.max(lineLower.indexOf(terms[0] ?? exact), 0),
          snippet: line.trim(),
          score,
          context: this.contextFor(lines, index),
        });
      });

      for (const symbol of file.symbols) {
        const haystack = `${symbol.name} ${symbol.signature ?? ''}`.toLowerCase();
        const score = this.scoreText(haystack, terms, exact) + (haystack.includes(exact) ? 4 : 0);
        if (score <= 0) continue;

        const key = `${symbol.filePath}:${symbol.lineStart}`;
        const existing = results.get(key);
        const line = lines[symbol.lineStart - 1] ?? symbol.signature ?? symbol.name;
        results.set(key, {
          filePath: symbol.filePath,
          line: symbol.lineStart,
          column: symbol.columnStart,
          snippet: line.trim(),
          score: Math.max(existing?.score ?? 0, score + 3),
          context: this.contextFor(lines, symbol.lineStart - 1),
        });
      }
    }

    return Array.from(results.values())
      .sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath) || a.line - b.line)
      .slice(offset, offset + limit);
  }

  async findReferences(
    symbol: string,
    filePath: string,
    line: number,
    workspaceId: string
  ): Promise<Reference[]> {
    const escaped = this.escapeRegex(symbol);
    const pattern = new RegExp(`\\b${escaped}\\b`);
    const references: Reference[] = [];

    for (const file of codeIndexStore.getFiles(workspaceId)) {
      const lines = file.content.split(/\r?\n/);
      lines.forEach((sourceLine, index) => {
        if (!pattern.test(sourceLine)) return;
        if (file.filePath === filePath && index + 1 === line) return;

        references.push({
          filePath: file.filePath,
          line: index + 1,
          column: Math.max(sourceLine.indexOf(symbol), 0),
          context: this.contextFor(lines, index),
          symbolName: symbol,
        });
      });
    }

    return references.sort((a, b) => a.filePath.localeCompare(b.filePath) || a.line - b.line);
  }

  async findDefinition(
    symbol: string,
    filePath: string,
    _line: number,
    workspaceId: string
  ): Promise<Definition | null> {
    const symbols = codeIndexStore
      .getSymbols(workspaceId)
      .filter((candidate) => candidate.name === symbol);
    const found = symbols.find((candidate) => candidate.filePath === filePath) ?? symbols[0];

    if (!found) return null;

    return {
      filePath: found.filePath,
      line: found.lineStart,
      column: found.columnStart,
      symbol: found.name,
      type: found.type,
      signature: found.signature,
      documentation: found.documentation,
    };
  }

  async getSymbolGraph(filePath: string, workspaceId: string): Promise<SymbolGraph> {
    const file = codeIndexStore.getFile(workspaceId, filePath);
    if (!file) return { symbols: [], edges: [] };

    return {
      symbols: file.symbols,
      edges: this.buildSymbolEdges(file, workspaceId),
    };
  }

  async analyzeFile(filePath: string, workspaceId: string): Promise<FileAnalysis> {
    const indexed = codeIndexStore.getFile(workspaceId, filePath);
    const language = indexed?.language ?? this.parser.detectLanguage(filePath);

    if (!language) {
      throw new Error(`Unsupported file type: ${filePath}`);
    }

    const files = codeIndexStore.getFiles(workspaceId);
    const graph = new Map(files.map((file) => [file.filePath, file.dependencies]));
    const cycles = this.analyzer.detectCircularDependencies(graph);
    const content = indexed?.content ?? '';

    return {
      filePath,
      language,
      symbols: indexed?.symbols ?? [],
      imports: indexed?.dependencies ?? [],
      exports: [],
      dependencies: indexed?.dependencies ?? [],
      circularDependencies: cycles
        .filter((cycle) => cycle.includes(filePath))
        .map((cycle) => cycle.join(' -> ')),
      unusedImports: [],
      complexity: this.estimateComplexity(content, indexed?.symbols.length ?? 0),
    };
  }

  async detectPatterns(workspaceId: string): Promise<Pattern[]> {
    const files = codeIndexStore.getFiles(workspaceId);
    const paths = files.map((file) => file.filePath);
    const patterns: Pattern[] = [];

    if (
      paths.some((file) => file.endsWith('.tsx')) &&
      paths.some((file) => file.includes('components/'))
    ) {
      patterns.push({
        name: 'React component architecture',
        type: 'architectural',
        confidence: 0.82,
        files: paths.filter((file) => file.endsWith('.tsx')).slice(0, 20),
        description: 'Workspace contains TSX components and component-oriented frontend structure.',
      });
    }

    if (
      paths.some((file) => file.includes('routes/')) &&
      paths.some((file) => file.endsWith('index.ts'))
    ) {
      patterns.push({
        name: 'API route module architecture',
        type: 'architectural',
        confidence: 0.74,
        files: paths.filter((file) => file.includes('routes/')).slice(0, 20),
        description: 'Workspace groups backend endpoints into route modules.',
      });
    }

    return patterns;
  }

  async findUnusedCode(workspaceId: string): Promise<UnusedCode[]> {
    const files = codeIndexStore.getFiles(workspaceId);
    const allContent = files.map((file) => file.content).join('\n');

    return codeIndexStore
      .getSymbols(workspaceId)
      .filter((symbol) =>
        ['function', 'class', 'interface', 'type', 'method'].includes(symbol.type)
      )
      .filter((symbol) => {
        const usageCount = (
          allContent.match(new RegExp(`\\b${this.escapeRegex(symbol.name)}\\b`, 'g')) ?? []
        ).length;
        return usageCount <= 1 && !/^main|App|index$/i.test(symbol.name);
      })
      .map((symbol) => ({
        filePath: symbol.filePath,
        symbolName: symbol.name,
        type: symbol.type,
        line: symbol.lineStart,
        reason: 'Symbol was only found at its declaration in the current in-memory index.',
      }));
  }

  private filterFiles(files: IndexedCodeFile[], options: SearchOptions): IndexedCodeFile[] {
    return files.filter((file) => {
      if (options.fileTypes?.length) {
        const suffixMatches = options.fileTypes.some((type) => file.filePath.endsWith(type));
        const languageMatches = options.fileTypes.includes(file.language);
        if (!suffixMatches && !languageMatches) return false;
      }

      if (
        options.directories?.length &&
        !options.directories.some((directory) => file.filePath.startsWith(directory))
      ) {
        return false;
      }

      return true;
    });
  }

  private tokenize(query: string): string[] {
    return query
      .toLowerCase()
      .split(/[^a-z0-9_$]+/i)
      .map((term) => term.trim())
      .filter((term) => term.length >= 2);
  }

  private scoreText(haystack: string, terms: string[], exact: string): number {
    if (!haystack) return 0;
    let score = exact && haystack.includes(exact) ? 5 : 0;

    for (const term of terms) {
      const matches = haystack.match(new RegExp(this.escapeRegex(term), 'g'))?.length ?? 0;
      score += matches;
    }

    return score;
  }

  private contextFor(lines: string[], index: number): string {
    const start = Math.max(index - 2, 0);
    const end = Math.min(index + 3, lines.length);
    return lines
      .slice(start, end)
      .map((line, offset) => `${start + offset + 1}: ${line}`)
      .join('\n');
  }

  private estimateComplexity(content: string, symbolCount: number): number {
    const branchCount = (
      content.match(/\b(if|for|while|switch|case|catch|try|except|match)\b/g) ?? []
    ).length;
    return symbolCount + branchCount;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
  }

  private buildSymbolEdges(file: IndexedCodeFile, workspaceId: string): SymbolEdge[] {
    const edges: SymbolEdge[] = [];
    const sourceSymbol = file.symbols[0];
    if (!sourceSymbol) return edges;

    for (const dependency of file.dependencies) {
      const targetFile = this.resolveDependencyFile(file.filePath, dependency, workspaceId);
      for (const target of targetFile?.symbols ?? []) {
        edges.push(this.edge(sourceSymbol, target, 'imports'));
      }
    }

    for (const source of file.symbols) {
      const body = this.symbolBody(file.content, source);
      for (const target of codeIndexStore.getSymbols(workspaceId)) {
        if (target.id === source.id) continue;
        if (!new RegExp(`\\b${this.escapeRegex(target.name)}\\s*\\(`).test(body)) continue;
        edges.push(this.edge(source, target, 'calls'));
      }
    }

    return this.dedupeEdges(edges);
  }

  private resolveDependencyFile(
    currentFilePath: string,
    dependency: string,
    workspaceId: string
  ): IndexedCodeFile | undefined {
    const files = codeIndexStore.getFiles(workspaceId);
    if (!dependency.startsWith('.')) {
      return files.find((file) => file.filePath.includes(`/${dependency}`));
    }

    const baseDirectory = currentFilePath.split('/').slice(0, -1).join('/');
    const normalized = new URL(
      dependency,
      `file:///${baseDirectory ? `${baseDirectory}/` : ''}`
    ).pathname.replace(/^\/+/, '');
    const candidates = [
      normalized,
      `${normalized}.ts`,
      `${normalized}.tsx`,
      `${normalized}.js`,
      `${normalized}.jsx`,
      `${normalized}.py`,
      `${normalized}/index.ts`,
      `${normalized}/index.tsx`,
      `${normalized}/index.js`,
    ];

    return files.find((file) => candidates.includes(file.filePath));
  }

  private symbolBody(content: string, symbol: CodeSymbol): string {
    const lines = content.split(/\r?\n/);
    const start = Math.max(symbol.lineStart - 1, 0);
    const nextStart = lines.findIndex((line, index) => {
      if (index <= start) return false;
      return /^(?:export\s+)?(?:async\s+)?function\s+|^(?:export\s+)?class\s+|^(?:export\s+)?interface\s+|^\s*(?:async\s+)?def\s+/i.test(
        line.trim()
      );
    });
    return lines.slice(start, nextStart === -1 ? lines.length : nextStart).join('\n');
  }

  private edge(
    from: CodeSymbol,
    to: CodeSymbol,
    edgeType: SymbolEdge['edgeType']
  ): SymbolEdge {
    return {
      id: `edge_${from.id}_${edgeType}_${to.id}`,
      fromSymbolId: from.id,
      toSymbolId: to.id,
      edgeType,
    };
  }

  private dedupeEdges(edges: SymbolEdge[]): SymbolEdge[] {
    return Array.from(new Map(edges.map((edge) => [edge.id, edge])).values());
  }
}

/**
 * Create a new code intelligence engine instance
 */
export function createCodeIntelligenceEngine(): ICodeIntelligenceEngine {
  return new CodeIntelligenceEngine();
}
