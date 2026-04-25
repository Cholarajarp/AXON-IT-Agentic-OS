import type { SymbolType } from './types.js';

export interface SymbolMatch {
  name: string;
  type: SymbolType;
  nodeType: string;
}

const commonControlWords = new Set([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'return',
  'function',
  'describe',
  'it',
  'test',
]);

export function detectLanguage(filePath: string): string {
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

export function matchSymbol(line: string, language: string): SymbolMatch | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) return null;

  if (language === 'typescript' || language === 'javascript') return matchTypeScriptSymbol(trimmed);
  if (language === 'python') return matchPythonSymbol(trimmed);
  if (language === 'go') return matchGoSymbol(trimmed);
  if (language === 'rust') return matchRustSymbol(trimmed);
  if (language === 'java' || language === 'cpp') return matchClassicalSymbol(trimmed);
  return null;
}

function matchTypeScriptSymbol(trimmed: string): SymbolMatch | null {
  const patterns: Array<[RegExp, SymbolType, string]> = [
    [/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/, 'function', 'function_declaration'],
    [/^(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)\b/, 'class', 'class_declaration'],
    [/^(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)\b/, 'interface', 'interface_declaration'],
    [/^(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*=/, 'type', 'type_alias_declaration'],
    [/^(?:export\s+)?enum\s+([A-Za-z_$][\w$]*)\b/, 'enum', 'enum_declaration'],
    [/^(?:export\s+)?namespace\s+([A-Za-z_$][\w$]*)\b/, 'namespace', 'namespace_declaration'],
    [/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/, 'function', 'arrow_function'],
    [/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/, 'variable', 'variable_declaration'],
  ];

  const matched = firstPatternMatch(trimmed, patterns);
  if (matched) return matched;

  const method =
    /^(?:(?:public|private|protected|static|async|override|readonly)\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::\s*[^=>{]+)?[{;]?$/.exec(
      trimmed
    );
  if (method?.[1] && !commonControlWords.has(method[1])) {
    return { name: method[1], type: 'method', nodeType: 'method_definition' };
  }
  return null;
}

function matchPythonSymbol(trimmed: string): SymbolMatch | null {
  const def = /^(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/.exec(trimmed);
  if (def?.[1]) return { name: def[1], type: 'function', nodeType: 'function_definition' };

  const cls = /^class\s+([A-Za-z_]\w*)\b/.exec(trimmed);
  if (cls?.[1]) return { name: cls[1], type: 'class', nodeType: 'class_definition' };
  return null;
}

function matchGoSymbol(trimmed: string): SymbolMatch | null {
  const fn = /^func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s*\(/.exec(trimmed);
  if (fn?.[1]) return { name: fn[1], type: 'function', nodeType: 'function_declaration' };

  const type = /^type\s+([A-Za-z_]\w*)\s+(?:struct|interface)\b/.exec(trimmed);
  if (type?.[1]) return { name: type[1], type: 'type', nodeType: 'type_declaration' };
  return null;
}

function matchRustSymbol(trimmed: string): SymbolMatch | null {
  return firstPatternMatch(trimmed, [
    [/^(?:pub\s+)?fn\s+([A-Za-z_]\w*)\s*\(/, 'function', 'function_item'],
    [/^(?:pub\s+)?struct\s+([A-Za-z_]\w*)\b/, 'class', 'struct_item'],
    [/^(?:pub\s+)?enum\s+([A-Za-z_]\w*)\b/, 'enum', 'enum_item'],
    [/^(?:pub\s+)?trait\s+([A-Za-z_]\w*)\b/, 'interface', 'trait_item'],
  ]);
}

function matchClassicalSymbol(trimmed: string): SymbolMatch | null {
  const classLike =
    /^(?:public\s+|private\s+|protected\s+)?(?:abstract\s+)?(class|interface|enum)\s+([A-Za-z_]\w*)\b/.exec(
      trimmed
    );
  if (classLike?.[1] && classLike[2]) {
    const symbolType =
      classLike[1] === 'enum' ? 'enum' : classLike[1] === 'interface' ? 'interface' : 'class';
    return { name: classLike[2], type: symbolType, nodeType: `${classLike[1]}_declaration` };
  }

  const fn = /(?:^|[\s*&])([A-Za-z_]\w*)\s*\([^;]*\)\s*(?:const\s*)?[{;]?$/.exec(trimmed);
  if (fn?.[1] && !commonControlWords.has(fn[1]) && !trimmed.startsWith('#')) {
    return { name: fn[1], type: 'function', nodeType: 'function_declaration' };
  }
  return null;
}

function firstPatternMatch(
  trimmed: string,
  patterns: Array<[RegExp, SymbolType, string]>,
): SymbolMatch | null {
  for (const [pattern, type, nodeType] of patterns) {
    const name = pattern.exec(trimmed)?.[1];
    if (name) return { name, type, nodeType };
  }
  return null;
}
