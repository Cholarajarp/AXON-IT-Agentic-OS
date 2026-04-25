/**
 * Safe command parsing and argv construction for shell-like tools.
 *
 * We deliberately do NOT call `exec(cmdString)` with user-controlled fragments.
 * Instead, commands arrive as structured { program, args } pairs that we pass
 * to `execFile`, which spawns without a shell interpreter — eliminating shell
 * metacharacter injection (`$(...)`, backticks, `;`, `&&`, `|`, redirects).
 *
 * For tools that must accept a raw command string (the legacy shell tool),
 * we parse with a minimal POSIX-like tokenizer that rejects pipes, redirects,
 * subshells, and command chaining. If any forbidden token appears, we refuse.
 */

export interface ParsedCommand {
  program: string;
  args: string[];
}

const FORBIDDEN_SHELL_METACHARS = /[;&|`$<>(){}\\]/;
const FORBIDDEN_SUBSTRINGS = ['$(', '`', '&&', '||', '>>', '>', '<<', '<', '|'];

/**
 * Parse a single-program command string with simple whitespace and quoting.
 * Supports: "double-quoted" and 'single-quoted' argument grouping.
 * Rejects: any shell metacharacter outside of quoted strings.
 */
export function parseSafeCommand(raw: string): ParsedCommand | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { error: 'Command is empty' };

  for (const bad of FORBIDDEN_SUBSTRINGS) {
    // Allow these only if they are fully inside quotes — but rather than parsing
    // quotes twice, we reject any occurrence for the raw path. If a caller
    // needs them, they should use the structured { program, args } variant.
    if (trimmed.includes(bad)) {
      return { error: `Command contains forbidden shell operator: ${bad}` };
    }
  }

  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]!;
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    if (FORBIDDEN_SHELL_METACHARS.test(ch)) {
      return { error: `Command contains forbidden character: ${ch}` };
    }
    current += ch;
  }
  if (quote) return { error: 'Unbalanced quote in command' };
  if (current) tokens.push(current);

  if (tokens.length === 0) return { error: 'Command is empty after parsing' };

  return { program: tokens[0]!, args: tokens.slice(1) };
}

/**
 * Allowlist of program names permitted for shell-style execution.
 * Anything outside this list is refused, regardless of path.
 * Paths are stripped before matching so `/bin/ls` and `ls` both match `ls`.
 */
export const DEFAULT_SHELL_ALLOWLIST = new Set<string>([
  'ls', 'cat', 'grep', 'find', 'head', 'tail', 'wc', 'sort', 'uniq',
  'echo', 'pwd', 'which', 'file', 'stat', 'du', 'df',
  'node', 'npm', 'npx', 'pnpm', 'yarn',
  'tsc', 'tsx', 'vitest', 'jest', 'eslint', 'prettier',
  'python', 'python3', 'pip', 'pip3',
  'git',
  'go', 'cargo', 'rustc',
  'docker', 'kubectl',
  'curl', 'wget', // SSRF-guarded via url validation in http tool; in shell the allowlist still lets these through but they are logged.
]);

export function isProgramAllowed(program: string, allowlist: Set<string> = DEFAULT_SHELL_ALLOWLIST): boolean {
  // Strip path; match on basename only.
  const base = program.split(/[\\/]/).pop() ?? program;
  return allowlist.has(base);
}
