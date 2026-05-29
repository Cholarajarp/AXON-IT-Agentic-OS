import type { IntegrationConfig, IntegrationConnector, ITSMTicket } from '../types.js';
import { TicketMemory } from './ticket-store.js';

export class ServiceNowConnector implements IntegrationConnector {
  type = 'servicenow' as const;
  name = 'ServiceNow';
  private config?: IntegrationConfig;
  private connected = false;
  private readonly store = new TicketMemory(this.type);

  async connect(config: IntegrationConfig): Promise<boolean> {
    this.config = config;
    this.connected = true;
    return true;
  }

  async disconnect() { this.connected = false; }

  async healthCheck(): Promise<boolean> { return this.connected; }

  async createTicket(ticket: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return this.store.create(ticket, {
      externalId: this.store.nextExternalId('INC', 1000000, 7),
      type: ticket.type || 'incident',
      title: ticket.title || 'Untitled',
      priority: ticket.priority || 'P2',
      status: 'New',
      metadata: { instance: this.config?.baseUrl, category: 'IT Services' },
    });
  }

  async updateTicket(id: string, updates: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return this.store.update(id, updates, { externalId: id, type: 'incident', title: updates.title || 'ServiceNow Incident', priority: 'P2', status: updates.status || 'In Progress' });
  }

  async getTicket(id: string): Promise<ITSMTicket | null> {
    return this.store.get(id);
  }

  async listTickets(): Promise<ITSMTicket[]> {
    return this.store.list();
  }
}
