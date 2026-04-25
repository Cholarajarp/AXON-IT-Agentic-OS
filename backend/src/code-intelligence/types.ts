/**
 * Code Intelligence Engine - Type Definitions
 * Provides deep code understanding through AST parsing, symbol extraction, and semantic search
 */

export type SupportedLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'go'
  | 'rust'
  | 'cpp';

export type SymbolType =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'variable'
  | 'method'
  | 'property'
  | 'enum'
  | 'namespace';

export type EdgeType = 'calls' | 'imports' | 'extends' | 'implements' | 'uses';

export interface ASTNode {
  type: string;
  startPosition: Position;
  endPosition: Position;
  text: string;
  children?: ASTNode[];
}

export interface Position {
  row: number;
  column: number;
}

export interface Symbol {
  id: string;
  name: string;
  type: SymbolType;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  columnStart: number;
  columnEnd: number;
  documentation?: string;
  signature?: string;
  parentId?: string;
}

export interface SymbolEdge {
  id: string;
  fromSymbolId: string;
  toSymbolId: string;
  edgeType: EdgeType;
}

export interface SymbolGraph {
  symbols: Symbol[];
  edges: SymbolEdge[];
}

export interface IndexedFile {
  id: string;
  workspaceId: string;
  filePath: string;
  language: SupportedLanguage;
  contentHash: string;
  sizeBytes: number;
  lastModified: Date;
  indexedAt: Date;
}

export interface CodeEmbedding {
  id: string;
  fileId: string;
  symbolId?: string;
  contentSnippet: string;
  embedding: number[];
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  fileTypes?: string[];
  directories?: string[];
  semantic?: boolean;
}

export interface SearchResult {
  filePath: string;
  line: number;
  column: number;
  snippet: string;
  score: number;
  context?: string;
}

export interface Reference {
  filePath: string;
  line: number;
  column: number;
  context: string;
  symbolName: string;
}

export interface Definition {
  filePath: string;
  line: number;
  column: number;
  symbol: string;
  type: SymbolType;
  signature?: string;
  documentation?: string;
}

export interface IndexResult {
  filesIndexed: number;
  symbolsExtracted: number;
  durationMs: number;
  errors: IndexError[];
}

export interface IndexError {
  filePath: string;
  error: string;
  line?: number;
}

export interface FileAnalysis {
  filePath: string;
  language: SupportedLanguage;
  symbols: Symbol[];
  imports: string[];
  exports: string[];
  dependencies: string[];
  circularDependencies: string[];
  unusedImports: string[];
  complexity: number;
}

export interface Pattern {
  name: string;
  type: 'architectural' | 'design' | 'anti-pattern';
  confidence: number;
  files: string[];
  description: string;
}

export interface UnusedCode {
  filePath: string;
  symbolName: string;
  type: SymbolType;
  line: number;
  reason: string;
}

/**
 * AST Parser Interface
 */
export interface IASTParser {
  /**
   * Parse source code into an Abstract Syntax Tree
   */
  parse(code: string, language: SupportedLanguage): Promise<ASTNode>;

  /**
   * Detect language from file extension
   */
  detectLanguage(filePath: string): SupportedLanguage | null;

  /**
   * Traverse AST and extract nodes matching a predicate
   */
  traverse(node: ASTNode, predicate: (node: ASTNode) => boolean): ASTNode[];
}

/**
 * Symbol Extractor Interface
 */
export interface ISymbolExtractor {
  /**
   * Extract symbols from an AST
   */
  extractSymbols(ast: ASTNode, filePath: string): Promise<Symbol[]>;

  /**
   * Build parent-child relationships for nested symbols
   */
  buildHierarchy(symbols: Symbol[]): Symbol[];

  /**
   * Extract function signature
   */
  extractSignature(node: ASTNode): string;
}

/**
 * Dependency Analyzer Interface
 */
export interface IDependencyAnalyzer {
  /**
   * Analyze file dependencies
   */
  analyzeDependencies(filePath: string, ast: ASTNode): Promise<string[]>;

  /**
   * Build dependency graph for workspace
   */
  buildDependencyGraph(workspaceId: string): Promise<Map<string, string[]>>;

  /**
   * Detect circular dependencies
   */
  detectCircularDependencies(graph: Map<string, string[]>): string[][];
}

/**
 * Workspace Indexer Interface
 */
export interface IWorkspaceIndexer {
  /**
   * Index entire workspace
   */
  indexWorkspace(workspacePath: string, workspaceId: string): Promise<IndexResult>;

  /**
   * Update index for a single file
   */
  updateFile(filePath: string, content: string, workspaceId: string): Promise<void>;

  /**
   * Remove file from index
   */
  removeFile(filePath: string, workspaceId: string): Promise<void>;

  /**
   * Get indexing status
   */
  getStatus(workspaceId: string): Promise<IndexStatus>;
}

export interface IndexStatus {
  workspaceId: string;
  totalFiles: number;
  indexedFiles: number;
  inProgress: boolean;
  lastIndexedAt?: Date;
  errors: IndexError[];
}

/**
 * Semantic Search Interface
 */
export interface ISemanticSearch {
  /**
   * Generate embedding for text
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * Search code by semantic similarity
   */
  search(query: string, workspaceId: string, options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * Index code snippet for semantic search
   */
  indexSnippet(fileId: string, snippet: string, symbolId?: string): Promise<void>;
}

/**
 * Code Intelligence Engine Interface
 */
export interface ICodeIntelligenceEngine {
  // Indexing
  indexWorkspace(workspacePath: string, workspaceId: string): Promise<IndexResult>;
  updateFile(filePath: string, content: string, workspaceId: string): Promise<void>;
  removeFile(filePath: string, workspaceId: string): Promise<void>;
  getStatus(workspaceId: string): Promise<IndexStatus>;

  // Querying
  searchCode(query: string, workspaceId: string, options?: SearchOptions): Promise<SearchResult[]>;
  findReferences(
    symbol: string,
    filePath: string,
    line: number,
    workspaceId: string
  ): Promise<Reference[]>;
  findDefinition(
    symbol: string,
    filePath: string,
    line: number,
    workspaceId: string
  ): Promise<Definition | null>;
  getSymbolGraph(filePath: string, workspaceId: string): Promise<SymbolGraph>;

  // Analysis
  analyzeFile(filePath: string, workspaceId: string): Promise<FileAnalysis>;
  detectPatterns(workspaceId: string): Promise<Pattern[]>;
  findUnusedCode(workspaceId: string): Promise<UnusedCode[]>;
}
