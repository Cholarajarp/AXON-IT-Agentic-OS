import type { IntegrationConfig, IntegrationConnector, ITSMTicket } from '../types.js';
import { TicketMemory } from './ticket-store.js';

export class SlackConnector implements IntegrationConnector {
  type = 'slack' as const;
  name = 'Slack';
  private connected = false;
  private readonly store = new TicketMemory(this.type);

  async connect(_config: IntegrationConfig): Promise<boolean> { this.connected = true; return true; }
  async disconnect() { this.connected = false; }
  async healthCheck(): Promise<boolean> { return this.connected; }

  async createTicket(ticket: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return this.store.create(ticket, {
      externalId: this.store.nextExternalId('SLACK-', 1000),
      type: ticket.type || 'service_request',
      title: ticket.title || 'Slack Thread',
      priority: ticket.priority || 'P3',
      status: 'Notified',
    });
  }

  async updateTicket(id: string, updates: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return this.store.update(id, updates, { externalId: id, type: 'service_request', title: updates.title || 'Slack Thread', priority: 'P3', status: updates.status || 'Updated' });
  }

  async getTicket(id: string): Promise<ITSMTicket | null> {
    return this.store.get(id);
  }

  async listTickets(): Promise<ITSMTicket[]> { return this.store.list(); }

  async sendNotification(message: string, channel = '#axon-alerts'): Promise<boolean> {
    console.log(`[Slack → ${channel}] ${message}`);
    return true;
  }
}
