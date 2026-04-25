import { nanoid } from 'nanoid';
import type { IntegrationConfig, IntegrationConnector, ITSMTicket } from '../types.js';

export class SlackConnector implements IntegrationConnector {
  type = 'slack' as const;
  name = 'Slack';
  private connected = false;

  async connect(_config: IntegrationConfig): Promise<boolean> { this.connected = true; return true; }
  async disconnect() { this.connected = false; }
  async healthCheck(): Promise<boolean> { return this.connected; }

  async createTicket(ticket: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return { id: nanoid(12), externalId: `slack-${nanoid(6)}`, type: ticket.type || 'service_request', title: ticket.title || '', description: ticket.description || '', priority: ticket.priority || 'P3', status: 'Notified', source: 'slack' as any, createdAt: Date.now(), updatedAt: Date.now() };
  }

  async updateTicket(id: string, updates: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return { id, externalId: id, type: 'service_request', title: updates.title || '', description: '', priority: 'P3', status: 'Updated', source: 'slack' as any, createdAt: Date.now(), updatedAt: Date.now() };
  }

  async getTicket(id: string): Promise<ITSMTicket | null> {
    return { id, externalId: id, type: 'service_request', title: 'Slack Thread', description: '', priority: 'P3', status: 'Open', source: 'slack' as any, createdAt: Date.now(), updatedAt: Date.now() };
  }

  async listTickets(): Promise<ITSMTicket[]> { return []; }

  async sendNotification(message: string, channel = '#axon-alerts'): Promise<boolean> {
    console.log(`[Slack → ${channel}] ${message}`);
    return true;
  }
}
