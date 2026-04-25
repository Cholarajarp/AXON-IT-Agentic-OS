import { nanoid } from 'nanoid';
import type { IntegrationConfig, IntegrationConnector, ITSMTicket } from '../types.js';

export class GitHubConnector implements IntegrationConnector {
  type = 'github' as const;
  name = 'GitHub';
  private connected = false;

  async connect(_config: IntegrationConfig): Promise<boolean> { this.connected = true; return true; }
  async disconnect() { this.connected = false; }
  async healthCheck(): Promise<boolean> { return this.connected; }

  async createTicket(ticket: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return {
      id: nanoid(12),
      externalId: `#${Math.floor(Math.random() * 900) + 100}`,
      type: ticket.type || 'service_request',
      title: ticket.title || 'GitHub Issue',
      description: ticket.description || '',
      priority: ticket.priority || 'P3',
      status: 'Open',
      source: 'github' as any,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: { repo: 'axon-platform', labels: ['agent-created', 'automated'] },
    };
  }

  async updateTicket(id: string, updates: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return { id, externalId: id, type: 'service_request', title: updates.title || '', description: '', priority: 'P3', status: updates.status || 'Open', source: 'github' as any, createdAt: Date.now(), updatedAt: Date.now() };
  }

  async getTicket(id: string): Promise<ITSMTicket | null> {
    return { id, externalId: id, type: 'service_request', title: 'GitHub Issue', description: '', priority: 'P3', status: 'Open', source: 'github' as any, createdAt: Date.now(), updatedAt: Date.now() };
  }

  async listTickets(): Promise<ITSMTicket[]> { return []; }
}
