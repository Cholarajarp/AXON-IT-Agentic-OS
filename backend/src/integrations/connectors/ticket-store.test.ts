import { describe, expect, it } from 'vitest';
import { JiraConnector } from './jira.js';

describe('integration connector ticket memory', () => {
  it('persists created tickets for list, get, and update flows', async () => {
    const connector = new JiraConnector();
    await connector.connect({
      type: 'jira',
      name: 'Jira',
      baseUrl: 'https://jira.example.com',
      credentials: { type: 'token', token: 'test-token' },
      enabled: true,
      tenantId: 'tenant_default',
    });

    const created = await connector.createTicket({
      title: 'Provision enterprise SSO',
      description: 'Create the implementation task and evidence checklist.',
      priority: 'P1',
    });
    const second = await connector.createTicket({
      title: 'Review rollout evidence',
      priority: 'P2',
    });

    expect(created.externalId).toBe('SUTR-1000');
    expect(second.externalId).toBe('SUTR-1001');
    expect(await connector.getTicket(created.id)).toMatchObject({ id: created.id, title: 'Provision enterprise SSO' });

    const updated = await connector.updateTicket(created.externalId, { status: 'In Progress', assignee: 'Platform Team' });
    expect(updated).toMatchObject({ externalId: 'SUTR-1000', status: 'In Progress', assignee: 'Platform Team' });

    await expect(connector.listTickets()).resolves.toEqual([
      expect.objectContaining({ externalId: 'SUTR-1000' }),
      expect.objectContaining({ externalId: 'SUTR-1001' }),
    ]);
  });
});
