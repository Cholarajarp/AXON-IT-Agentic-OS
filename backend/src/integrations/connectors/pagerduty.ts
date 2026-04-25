import { nanoid } from 'nanoid';
import type { IntegrationConfig, IntegrationConnector, ITSMTicket } from '../types.js';

export class PagerDutyConnector implements IntegrationConnector {
  type = 'pagerduty' as const;
  name = 'PagerDuty';
  private connected = false;

  async connect(_config: IntegrationConfig): Promise<boolean> { this.connected = true; return true; }
  async disconnect() { this.connected = false; }
  async healthCheck(): Promise<boolean> { return this.connected; }

  async createTicket(ticket: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return {
      id: nanoid(12),
      externalId: `PD-${nanoid(8).toUpperCase()}`,
      type: 'incident',
      title: ticket.title || 'PagerDuty Alert',
      description: ticket.description || '',
      priority: ticket.priority || 'P1',
      status: 'Triggered',
      source: 'pagerduty',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: { urgency: 'high', escalationPolicy: 'default' },
    };
  }

  async updateTicket(id: string, updates: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return { id, externalId: id, type: 'incident', title: updates.title || '', description: '', priority: 'P1', status: updates.status || 'Acknowledged', source: 'pagerduty', createdAt: Date.now(), updatedAt: Date.now() };
  }

  async getTicket(id: string): Promise<ITSMTicket | null> {
    return { id, externalId: id, type: 'incident', title: 'PagerDuty Incident', description: '', priority: 'P1', status: 'Triggered', source: 'pagerduty', createdAt: Date.now(), updatedAt: Date.now() };
  }

  async listTickets(): Promise<ITSMTicket[]> {
    return [
      { id: '1', externalId: 'PD-ABC123', type: 'incident', title: 'High CPU on payment-service', description: '', priority: 'P0', status: 'Triggered', source: 'pagerduty', createdAt: Date.now() - 300000, updatedAt: Date.now() },
    ];
  }

  async sendNotification(message: string): Promise<boolean> {
    console.log(`[PagerDuty] Notification: ${message}`);
    return true;
  }
}
