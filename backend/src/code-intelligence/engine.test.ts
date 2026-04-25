import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCodeIntelligenceEngine } from './engine.js';

let workspaceRoot: string;

async function writeWorkspaceFile(relativePath: string, content: string) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, 'utf8');
}

describe('CodeIntelligenceEngine', () => {
  beforeEach(async () => {
    workspaceRoot = await mkdtemp(path.join(tmpdir(), 'axon-code-intel-'));
    await writeWorkspaceFile(
      'src/user-service.ts',
      [
        'export interface User {',
        '  id: string;',
        '}',
        '',
        '// Create a user in the local test service.',
        'export function createUser(id: string): User {',
        '  return { id };',
        '}',
      ].join('\n')
    );
    await writeWorkspaceFile(
      'src/app.ts',
      [
        "import { createUser } from './user-service';",
        '',
        'export function runApp() {',
        "  return createUser('u_123');",
        '}',
      ].join('\n')
    );
    await writeWorkspaceFile(
      'scripts/report.py',
      [
        'from pathlib import Path',
        '',
        'class ReportBuilder:',
        '    def build(self):',
        '        return Path(".")',
      ].join('\n')
    );
    await writeWorkspaceFile('node_modules/ignored.ts', 'export function ignored() {}');
  });

  afterEach(async () => {
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('indexes supported files, extracts symbols, and skips ignored directories', async () => {
    const engine = createCodeIntelligenceEngine();
    const result = await engine.indexWorkspace(workspaceRoot, 'workspace_test');

    expect(result.errors).toEqual([]);
    expect(result.filesIndexed).toBe(3);
    expect(result.symbolsExtracted).toBeGreaterThanOrEqual(5);

    const status = await engine.getStatus('workspace_test');
    expect(status).toMatchObject({
      workspaceId: 'workspace_test',
      indexedFiles: 3,
      inProgress: false,
    });
  });

  it('searches code and resolves definitions and references', async () => {
    const engine = createCodeIntelligenceEngine();
    await engine.indexWorkspace(workspaceRoot, 'workspace_search');

    const search = await engine.searchCode('create user', 'workspace_search', { limit: 5 });
    expect(search[0]).toMatchObject({
      filePath: 'src/user-service.ts',
      snippet: 'export function createUser(id: string): User {',
    });

    const definition = await engine.findDefinition(
      'createUser',
      'src/app.ts',
      4,
      'workspace_search'
    );
    expect(definition).toMatchObject({
      filePath: 'src/user-service.ts',
      line: 6,
      symbol: 'createUser',
      type: 'function',
    });

    const references = await engine.findReferences(
      'createUser',
      'src/user-service.ts',
      6,
      'workspace_search'
    );
    expect(references.map((reference) => reference.filePath)).toContain('src/app.ts');
  });

  it('analyzes dependencies and symbol graph for an indexed file', async () => {
    const engine = createCodeIntelligenceEngine();
    await engine.indexWorkspace(workspaceRoot, 'workspace_analyze');

    const analysis = await engine.analyzeFile('src/app.ts', 'workspace_analyze');
    expect(analysis.dependencies).toContain('./user-service');
    expect(analysis.symbols.map((symbol) => symbol.name)).toContain('runApp');
    expect(analysis.complexity).toBeGreaterThan(0);

    const graph = await engine.getSymbolGraph('scripts/report.py', 'workspace_analyze');
    expect(graph.symbols.map((symbol) => symbol.name)).toEqual(
      expect.arrayContaining(['ReportBuilder', 'build'])
    );

    const appGraph = await engine.getSymbolGraph('src/app.ts', 'workspace_analyze');
    expect(appGraph.edges.some((edge) => edge.edgeType === 'imports')).toBe(true);
    expect(appGraph.edges.some((edge) => edge.edgeType === 'calls')).toBe(true);
  });
});
