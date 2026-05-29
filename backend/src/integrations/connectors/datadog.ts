import type { IntegrationConfig, IntegrationConnector, ITSMTicket } from '../types.js';
import { TicketMemory } from './ticket-store.js';

export class DatadogConnector implements IntegrationConnector {
  type = 'datadog' as const;
  name = 'Datadog';
  private connected = false;
  private readonly store = new TicketMemory(this.type);

  async connect(_config: IntegrationConfig): Promise<boolean> { this.connected = true; return true; }
  async disconnect() { this.connected = false; }
  async healthCheck(): Promise<boolean> { return this.connected; }

  async createTicket(ticket: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return this.store.create(ticket, {
      externalId: this.store.nextExternalId('DD-', 1000),
      type: 'incident',
      title: ticket.title || 'Datadog Alert',
      priority: ticket.priority || 'P2',
      status: 'Alert',
      metadata: { monitor: 'system.cpu.user', tags: ['env:production', 'service:api'] },
    });
  }

  async updateTicket(id: string, updates: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return this.store.update(id, updates, { externalId: id, type: 'incident', title: updates.title || 'Datadog Monitor Alert', priority: 'P2', status: updates.status || 'Warn' });
  }

  async getTicket(id: string): Promise<ITSMTicket | null> {
    return this.store.get(id);
  }

  async listTickets(): Promise<ITSMTicket[]> {
    return this.store.list();
  }
}
