import Fastify from 'fastify';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { registerStructureGuardianRoutes } from './structure-guardian.js';

describe('structure guardian routes', () => {
  it('recognizes the isolated legacy migration package without creating a second backend', async () => {
    const workspace = path.join(os.tmpdir(), `axon-structure-${Date.now()}`);
    await mkdir(path.join(workspace, 'src'), { recursive: true });
    await mkdir(path.join(workspace, 'backend', 'src'), { recursive: true });
    await mkdir(path.join(workspace, 'legacy', 'it-agentic-os', 'backend-src'), { recursive: true });
    await writeFile(path.join(workspace, 'package.json'), JSON.stringify({ name: '@axon/test' }));
    await writeFile(path.join(workspace, 'legacy', 'it-agentic-os', 'backend-src', 'index.ts'), 'export const legacy = true;\n');

    const app = Fastify();
    await app.register(registerStructureGuardianRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/structure-guardian/scan',
      payload: { workspacePath: workspace },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.status).not.toBe('blocked');
    expect(body.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'legacy-migration-package', action: 'migrate', blocksCleanup: false }),
        expect.objectContaining({ id: 'two-backends-explained', action: 'keep', blocksCleanup: false }),
      ]),
    );
    expect(body.validKeepPaths.map((entry: { path: string }) => entry.path)).toContain('legacy/it-agentic-os');

    await app.close();
  });
});
