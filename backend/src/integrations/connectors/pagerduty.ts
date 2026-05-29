import type { IntegrationConfig, IntegrationConnector, ITSMTicket } from '../types.js';
import { TicketMemory } from './ticket-store.js';

export class PagerDutyConnector implements IntegrationConnector {
  type = 'pagerduty' as const;
  name = 'PagerDuty';
  private connected = false;
  private readonly store = new TicketMemory(this.type);

  async connect(_config: IntegrationConfig): Promise<boolean> { this.connected = true; return true; }
  async disconnect() { this.connected = false; }
  async healthCheck(): Promise<boolean> { return this.connected; }

  async createTicket(ticket: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return this.store.create(ticket, {
      externalId: this.store.nextExternalId('PD-', 1000),
      type: 'incident',
      title: ticket.title || 'PagerDuty Alert',
      priority: ticket.priority || 'P1',
      status: 'Triggered',
      metadata: { urgency: 'high', escalationPolicy: 'default' },
    });
  }

  async updateTicket(id: string, updates: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return this.store.update(id, updates, { externalId: id, type: 'incident', title: updates.title || 'PagerDuty Incident', priority: 'P1', status: updates.status || 'Acknowledged' });
  }

  async getTicket(id: string): Promise<ITSMTicket | null> {
    return this.store.get(id);
  }

  async listTickets(): Promise<ITSMTicket[]> {
    return this.store.list();
  }

  async sendNotification(message: string): Promise<boolean> {
    console.log(`[PagerDuty] Notification: ${message}`);
    return true;
  }
}
