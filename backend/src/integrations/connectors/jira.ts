import type { IntegrationConfig, IntegrationConnector, ITSMTicket } from '../types.js';
import { TicketMemory } from './ticket-store.js';

export class JiraConnector implements IntegrationConnector {
  type = 'jira' as const;
  name = 'Jira Service Management';
  private config?: IntegrationConfig;
  private connected = false;
  private readonly store = new TicketMemory(this.type);

  async connect(config: IntegrationConfig): Promise<boolean> { this.config = config; this.connected = !!this.config; return true; }
  async disconnect() { this.connected = false; }
  async healthCheck(): Promise<boolean> { return this.connected; }

  async createTicket(ticket: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return this.store.create(ticket, {
      externalId: this.store.nextExternalId('SUTR-', 1000),
      type: ticket.type || 'service_request',
      title: ticket.title || 'Untitled',
      priority: ticket.priority || 'P2',
      status: 'To Do',
      metadata: { project: 'SUTR', issueType: ticket.type === 'incident' ? 'Bug' : 'Task' },
    });
  }

  async updateTicket(id: string, updates: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return this.store.update(id, updates, { externalId: id, type: 'service_request', title: updates.title || 'Jira Issue', priority: 'P2', status: updates.status || 'In Progress' });
  }

  async getTicket(id: string): Promise<ITSMTicket | null> {
    return this.store.get(id);
  }

  async listTickets(): Promise<ITSMTicket[]> {
    return this.store.list();
  }
}
