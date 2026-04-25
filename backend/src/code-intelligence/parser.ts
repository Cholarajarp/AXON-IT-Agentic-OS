/**
 * AST Parser Implementation
 * Multi-language parser using tree-sitter for deep code understanding
 */

import type { IASTParser, ASTNode, SupportedLanguage } from './types.js';

/**
 * Language file extension mappings
 */
const LANGUAGE_EXTENSIONS: Record<string, SupportedLanguage> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.h': 'cpp',
};

/**
 * Lightweight structural parser.
 *
 * This intentionally avoids native parser bindings so indexing works in local,
 * CI, and desktop installs without a compiler toolchain. It emits stable import,
 * export, declaration, method, and call-expression nodes that downstream
 * services can use for symbol graphs today. A future tree-sitter adapter can
 * preserve the same node contract.
 */
export class ASTParser implements IASTParser {
  /**
   * Parse source code into an Abstract Syntax Tree
   */
  async parse(code: string, language: SupportedLanguage): Promise<ASTNode> {
    const lines = code.split(/\r?\n/);
    const children: ASTNode[] = [];

    lines.forEach((line, row) => {
      const lineNode = this.lineNode(line, language, row);
      children.push(lineNode);
      children.push(...this.structuralNodes(line, language, row));
    });

    return {
      type: 'program',
      startPosition: { row: 0, column: 0 },
      endPosition: { row: Math.max(lines.length - 1, 0), column: lines.at(-1)?.length ?? 0 },
      text: code,
      children,
    };
  }

  /**
   * Detect language from file extension
   */
  detectLanguage(filePath: string): SupportedLanguage | null {
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    return LANGUAGE_EXTENSIONS[ext] || null;
  }

  /**
   * Traverse AST and extract nodes matching a predicate
   */
  traverse(node: ASTNode, predicate: (node: ASTNode) => boolean): ASTNode[] {
    const results: ASTNode[] = [];

    const visit = (current: ASTNode) => {
      if (predicate(current)) {
        results.push(current);
      }

      if (current.children) {
        for (const child of current.children) {
          visit(child);
        }
      }
    };

    visit(node);
    return results;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'cpp'];
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(language: string): boolean {
    return this.getSupportedLanguages().includes(language as SupportedLanguage);
  }

  private lineNode(line: string, language: SupportedLanguage, row: number): ASTNode {
    return {
      type: `${language}_line`,
      startPosition: { row, column: 0 },
      endPosition: { row, column: line.length },
      text: line,
      children: [],
    };
  }

  private structuralNodes(line: string, language: SupportedLanguage, row: number): ASTNode[] {
    const nodes: ASTNode[] = [];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) return nodes;

    const patterns = this.patternsFor(language);
    for (const pattern of patterns) {
      const match = pattern.regex.exec(line);
      if (!match?.[1]) continue;
      const column = Math.max(line.indexOf(match[1]), 0);
      nodes.push({
        type: pattern.type,
        startPosition: { row: row + 1, column },
        endPosition: { row: row + 1, column: line.length },
        text: line.trim(),
        children: [],
      });
    }

    for (const call of this.findCalls(line, language, row)) {
      nodes.push(call);
    }

    return nodes;
  }

  private patternsFor(language: SupportedLanguage): Array<{ type: string; regex: RegExp }> {
    if (language === 'typescript' || language === 'javascript') {
      return [
        { type: 'import_statement', regex: /^\s*import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/ },
        { type: 'export_statement', regex: /^\s*export\s+[\s\S]*?\s+from\s+["']([^"']+)["']/ },
        { type: 'function_declaration', regex: /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/ },
        { type: 'class_declaration', regex: /^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)\b/ },
        { type: 'interface_declaration', regex: /^\s*(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)\b/ },
        { type: 'type_alias_declaration', regex: /^\s*(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*=/ },
        { type: 'enum_declaration', regex: /^\s*(?:export\s+)?enum\s+([A-Za-z_$][\w$]*)\b/ },
        { type: 'arrow_function', regex: /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/ },
      ];
    }

    if (language === 'python') {
      return [
        { type: 'import_statement', regex: /^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/ },
        { type: 'function_definition', regex: /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/ },
        { type: 'class_definition', regex: /^\s*class\s+([A-Za-z_]\w*)\b/ },
      ];
    }

    if (language === 'go') {
      return [
        { type: 'import_statement', regex: /^\s*import\s+(?:\w+\s+)?["']([^"']+)["']/ },
        { type: 'function_declaration', regex: /^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s*\(/ },
        { type: 'type_declaration', regex: /^\s*type\s+([A-Za-z_]\w*)\s+(?:struct|interface)\b/ },
      ];
    }

    if (language === 'rust') {
      return [
        { type: 'import_statement', regex: /^\s*use\s+([^;]+);/ },
        { type: 'function_item', regex: /^\s*(?:pub\s+)?fn\s+([A-Za-z_]\w*)\s*\(/ },
        { type: 'struct_item', regex: /^\s*(?:pub\s+)?struct\s+([A-Za-z_]\w*)\b/ },
        { type: 'trait_item', regex: /^\s*(?:pub\s+)?trait\s+([A-Za-z_]\w*)\b/ },
      ];
    }

    return [
      { type: 'import_statement', regex: /^\s*(?:import\s+([\w.*]+)\s*;|#\s*include\s+[<"]([^>"]+)[>"])/ },
      { type: 'class_declaration', regex: /^\s*(?:public\s+|private\s+|protected\s+)?(?:abstract\s+)?(?:class|interface|enum)\s+([A-Za-z_]\w*)\b/ },
      { type: 'function_declaration', regex: /(?:^|[\s*&])([A-Za-z_]\w*)\s*\([^;]*\)\s*(?:const\s*)?[{;]?$/ },
    ];
  }

  private findCalls(line: string, language: SupportedLanguage, row: number): ASTNode[] {
    if (language === 'java' || language === 'cpp') return [];
    const calls: ASTNode[] = [];
    const reserved = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'new', 'class', 'def']);

    for (const match of line.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
      const name = match[1];
      if (!name || reserved.has(name)) continue;
      const column = match.index ?? 0;
      calls.push({
        type: 'call_expression',
        startPosition: { row: row + 1, column },
        endPosition: { row: row + 1, column: column + name.length },
        text: name,
        children: [],
      });
    }

    return calls;
  }
}

/**
 * Create a new AST parser instance
 */
export function createASTParser(): IASTParser {
  return new ASTParser();
}
