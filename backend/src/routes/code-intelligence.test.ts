import Fastify from 'fastify';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerCodeIntelligenceRoutes } from './code-intelligence.js';

let workspaceRoot: string;
let previousAllowedRoot: string | undefined;

async function writeWorkspaceFile(relativePath: string, content: string) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, 'utf8');
}

describe('code intelligence routes', () => {
  beforeEach(async () => {
    previousAllowedRoot = process.env.AXON_WORKSPACE_ROOT;
    workspaceRoot = await mkdtemp(path.join(tmpdir(), 'axon-code-route-'));
    process.env.AXON_WORKSPACE_ROOT = workspaceRoot;

    await writeWorkspaceFile(
      'src/math.ts',
      ['export function add(left: number, right: number) {', '  return left + right;', '}'].join(
        '\n'
      )
    );
  });

  afterEach(async () => {
    if (previousAllowedRoot === undefined) {
      delete process.env.AXON_WORKSPACE_ROOT;
    } else {
      process.env.AXON_WORKSPACE_ROOT = previousAllowedRoot;
    }
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('indexes and searches through the HTTP API', async () => {
    const app = Fastify();
    await app.register(registerCodeIntelligenceRoutes);

    const indexResponse = await app.inject({
      method: 'POST',
      url: '/code-intelligence/index',
      payload: { workspacePath: workspaceRoot, workspaceId: 'route_test' },
    });

    expect(indexResponse.statusCode).toBe(200);
    expect(indexResponse.json()).toMatchObject({ filesIndexed: 1, workspaceId: 'route_test' });

    const searchResponse = await app.inject({
      method: 'POST',
      url: '/code-intelligence/search',
      payload: { query: 'add numbers', workspaceId: 'route_test' },
    });

    expect(searchResponse.statusCode).toBe(200);
    expect(searchResponse.json().results[0]).toMatchObject({
      filePath: 'src/math.ts',
      snippet: 'export function add(left: number, right: number) {',
    });

    await app.close();
  });
});
