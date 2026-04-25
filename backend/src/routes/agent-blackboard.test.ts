import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerAgentBlackboardRoutes } from './agent-blackboard.js';

describe('agent blackboard routes', () => {
  it('records decisions, blockers, file ownership, and resolved status', async () => {
    const app = Fastify();
    await app.register(registerAgentBlackboardRoutes);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/agent-blackboard/boards',
      payload: {
        title: 'Payment portal build',
        goal: 'Coordinate product, database, security, QA, and release agents for a customer portal',
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const board = createResponse.json();

    const blockerResponse = await app.inject({
      method: 'POST',
      url: `/agent-blackboard/boards/${board.id}/entries`,
      payload: {
        kind: 'blocker',
        title: 'Database rollback proof missing',
        detail: 'Migration cannot release until backup and rollback preview are attached.',
        agent: 'MigrationSafetyAgent',
        severity: 'critical',
      },
    });

    expect(blockerResponse.statusCode).toBe(201);
    const blocker = blockerResponse.json();

    const claimResponse = await app.inject({
      method: 'POST',
      url: `/agent-blackboard/boards/${board.id}/file-claims`,
      payload: {
        filePath: 'backend/src/database-pipeline/service.ts',
        agent: 'MigrationSafetyAgent',
        reason: 'Owns migration review behavior',
      },
    });

    expect(claimResponse.statusCode).toBe(201);
    expect(claimResponse.json().fileOwnership[0].agent).toBe('MigrationSafetyAgent');
    expect(claimResponse.json().openBlockers).toBe(1);

    const resolveResponse = await app.inject({
      method: 'PATCH',
      url: `/agent-blackboard/boards/${board.id}/entries/${blocker.id}`,
      payload: { status: 'resolved' },
    });

    expect(resolveResponse.statusCode).toBe(200);
    expect(resolveResponse.json().status).toBe('resolved');

    await app.close();
  });
});
