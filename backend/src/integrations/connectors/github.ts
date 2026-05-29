import type { IntegrationConfig, IntegrationConnector, ITSMTicket } from '../types.js';
import { TicketMemory } from './ticket-store.js';

export class GitHubConnector implements IntegrationConnector {
  type = 'github' as const;
  name = 'GitHub';
  private connected = false;
  private readonly store = new TicketMemory(this.type);

  async connect(_config: IntegrationConfig): Promise<boolean> { this.connected = true; return true; }
  async disconnect() { this.connected = false; }
  async healthCheck(): Promise<boolean> { return this.connected; }

  async createTicket(ticket: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return this.store.create(ticket, {
      externalId: this.store.nextExternalId('#', 100),
      type: ticket.type || 'service_request',
      title: ticket.title || 'GitHub Issue',
      priority: ticket.priority || 'P3',
      status: 'Open',
      metadata: { repo: 'axon-platform', labels: ['agent-created', 'automated'] },
    });
  }

  async updateTicket(id: string, updates: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return this.store.update(id, updates, { externalId: id, type: 'service_request', title: updates.title || 'GitHub Issue', priority: 'P3', status: updates.status || 'Open' });
  }

  async getTicket(id: string): Promise<ITSMTicket | null> {
    return this.store.get(id);
  }

  async listTickets(): Promise<ITSMTicket[]> { return this.store.list(); }
}
