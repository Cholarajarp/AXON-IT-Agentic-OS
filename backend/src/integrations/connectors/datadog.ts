import { nanoid } from 'nanoid';
import type { IntegrationConfig, IntegrationConnector, ITSMTicket } from '../types.js';

export class DatadogConnector implements IntegrationConnector {
  type = 'datadog' as const;
  name = 'Datadog';
  private connected = false;

  async connect(_config: IntegrationConfig): Promise<boolean> { this.connected = true; return true; }
  async disconnect() { this.connected = false; }
  async healthCheck(): Promise<boolean> { return this.connected; }

  async createTicket(ticket: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return {
      id: nanoid(12),
      externalId: `DD-${Date.now().toString(36)}`,
      type: 'incident',
      title: ticket.title || 'Datadog Alert',
      description: ticket.description || '',
      priority: ticket.priority || 'P2',
      status: 'Alert',
      source: 'datadog',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: { monitor: 'system.cpu.user', tags: ['env:production', 'service:api'] },
    };
  }

  async updateTicket(id: string, updates: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return { id, externalId: id, type: 'incident', title: updates.title || '', description: '', priority: 'P2', status: updates.status || 'Warn', source: 'datadog', createdAt: Date.now(), updatedAt: Date.now() };
  }

  async getTicket(id: string): Promise<ITSMTicket | null> {
    return { id, externalId: id, type: 'incident', title: 'Datadog Monitor Alert', description: '', priority: 'P2', status: 'Alert', source: 'datadog', createdAt: Date.now(), updatedAt: Date.now() };
  }

  async listTickets(): Promise<ITSMTicket[]> {
    return [
      { id: '1', externalId: 'DD-alert-cpu', type: 'incident', title: 'CPU > 90% on api-gateway', description: 'Sustained for 5 minutes', priority: 'P1', status: 'Alert', source: 'datadog', createdAt: Date.now() - 600000, updatedAt: Date.now(), metadata: { metric: 'system.cpu.user', threshold: 90, current: 94.2 } },
      { id: '2', externalId: 'DD-alert-mem', type: 'incident', title: 'Memory leak detected in worker-pool', description: 'Linear growth over 2h', priority: 'P2', status: 'Warn', source: 'datadog', createdAt: Date.now() - 3600000, updatedAt: Date.now(), metadata: { metric: 'runtime.mem.rss', growthRate: '12MB/h' } },
    ];
  }
}
