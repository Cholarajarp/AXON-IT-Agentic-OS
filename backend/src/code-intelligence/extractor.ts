/**
 * Symbol Extractor Implementation
 * Extracts functions, classes, types, and other symbols from AST
 */

import { createHash } from 'node:crypto';
import { detectLanguage, matchSymbol } from './symbol-matchers.js';
import type { ASTNode, ISymbolExtractor, Symbol, SymbolType } from './types.js';

/**
 * Symbol Extractor
 * Extracts code symbols from Abstract Syntax Trees.
 *
 * This MVP uses deterministic line-level parsing. The interface remains AST-based
 * so tree-sitter can replace these matchers without changing callers.
 */
export class SymbolExtractor implements ISymbolExtractor {
  /**
   * Extract symbols from an AST
   */
  async extractSymbols(ast: ASTNode, filePath: string): Promise<Symbol[]> {
    const symbols: Symbol[] = [];
    const language = detectLanguage(filePath);
    const lines = ast.text.split(/\r?\n/);

    lines.forEach((line, index) => {
      const match = matchSymbol(line, language);
      if (!match) return;

      symbols.push(
        this.createSymbol(
          {
            type: match.nodeType,
            startPosition: { row: index + 1, column: line.search(/\S|$/) },
            endPosition: { row: index + 1, column: line.length },
            text: line.trim(),
          },
          filePath,
          match.name,
          match.type,
          undefined,
          this.extractDocumentationFromLines(lines, index)
        )
      );
    });

    return this.buildHierarchy(symbols);
  }

  /**
   * Build parent-child relationships for nested symbols
   */
  buildHierarchy(symbols: Symbol[]): Symbol[] {
    const symbolMap = new Map<string, Symbol>();
    for (const symbol of symbols) {
      symbolMap.set(symbol.id, symbol);
    }

    const rootSymbols: Symbol[] = [];
    for (const symbol of symbols) {
      if (symbol.parentId) {
        const parent = symbolMap.get(symbol.parentId);
        if (parent) {
          continue;
        }
      }
      rootSymbols.push(symbol);
    }

    return rootSymbols;
  }

  /**
   * Extract function signature from AST node
   */
  extractSignature(node: ASTNode): string {
    return node.text;
  }

  /**
   * Determine symbol type from AST node
   */
  protected getSymbolType(nodeType: string): SymbolType | null {
    const typeMap: Record<string, SymbolType> = {
      function_declaration: 'function',
      function_definition: 'function',
      function_item: 'function',
      arrow_function: 'function',
      function_expression: 'function',
      method_definition: 'method',
      class_declaration: 'class',
      class_definition: 'class',
      struct_item: 'class',
      interface_declaration: 'interface',
      trait_item: 'interface',
      type_alias_declaration: 'type',
      type_declaration: 'type',
      variable_declaration: 'variable',
      property_signature: 'property',
      enum_declaration: 'enum',
      enum_item: 'enum',
      namespace_declaration: 'namespace',
    };

    return typeMap[nodeType] || null;
  }

  /**
   * Extract documentation from comments
   */
  protected extractDocumentation(_node: ASTNode): string | undefined {
    return undefined;
  }

  /**
   * Create a symbol from an AST node
   */
  protected createSymbol(
    node: ASTNode,
    filePath: string,
    name: string,
    type: SymbolType,
    parentId?: string,
    documentation?: string
  ): Symbol {
    const stableId = createHash('sha256')
      .update(`${filePath}:${node.startPosition.row}:${type}:${name}`)
      .digest('hex')
      .slice(0, 16);

    return {
      id: `sym_${stableId}`,
      name,
      type,
      filePath,
      lineStart: node.startPosition.row,
      lineEnd: node.endPosition.row,
      columnStart: node.startPosition.column,
      columnEnd: node.endPosition.column,
      documentation: documentation ?? this.extractDocumentation(node),
      signature: this.extractSignature(node),
      parentId,
    };
  }

  private extractDocumentationFromLines(lines: string[], symbolIndex: number): string | undefined {
    const docs: string[] = [];

    for (let i = symbolIndex - 1; i >= 0; i--) {
      const trimmed = lines[i]?.trim() ?? '';
      if (!trimmed) {
        if (docs.length > 0) break;
        continue;
      }

      if (
        trimmed.startsWith('//') ||
        trimmed.startsWith('#') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('/**') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('"""')
      ) {
        docs.unshift(
          trimmed
            .replace(/^\/?\*+\/?/, '')
            .replace(/^\/\//, '')
            .replace(/^#/, '')
            .trim()
        );
        continue;
      }

      break;
    }

    return docs.length > 0 ? docs.join('\n') : undefined;
  }
}

/**
 * Create a new symbol extractor instance
 */
export function createSymbolExtractor(): ISymbolExtractor {
  return new SymbolExtractor();
}
