import { nanoid } from 'nanoid';
import type { IntegrationConfig, IntegrationConnector, ITSMTicket } from '../types.js';

export class ServiceNowConnector implements IntegrationConnector {
  type = 'servicenow' as const;
  name = 'ServiceNow';
  private config?: IntegrationConfig;
  private connected = false;

  async connect(config: IntegrationConfig): Promise<boolean> {
    this.config = config;
    this.connected = true;
    return true;
  }

  async disconnect() { this.connected = false; }

  async healthCheck(): Promise<boolean> { return this.connected; }

  async createTicket(ticket: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return {
      id: nanoid(12),
      externalId: `INC${String(Math.floor(Math.random() * 9000000) + 1000000)}`,
      type: ticket.type || 'incident',
      title: ticket.title || 'Untitled',
      description: ticket.description || '',
      priority: ticket.priority || 'P2',
      status: 'New',
      assignee: ticket.assignee,
      source: 'servicenow',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: { instance: this.config?.baseUrl, category: 'IT Services' },
    };
  }

  async updateTicket(id: string, updates: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return { id, externalId: id, type: 'incident', title: updates.title || '', description: '', priority: 'P2', status: updates.status || 'In Progress', source: 'servicenow', createdAt: Date.now(), updatedAt: Date.now() };
  }

  async getTicket(id: string): Promise<ITSMTicket | null> {
    return { id, externalId: id, type: 'incident', title: 'ServiceNow Incident', description: 'Retrieved from ServiceNow', priority: 'P2', status: 'Open', source: 'servicenow', createdAt: Date.now() - 3600000, updatedAt: Date.now() };
  }

  async listTickets(): Promise<ITSMTicket[]> {
    return [
      { id: '1', externalId: 'INC0012345', type: 'incident', title: 'Network latency in ap-south-1', description: '', priority: 'P1', status: 'In Progress', source: 'servicenow', createdAt: Date.now() - 7200000, updatedAt: Date.now() },
      { id: '2', externalId: 'CHG0045678', type: 'change', title: 'Upgrade PostgreSQL to v17', description: '', priority: 'P3', status: 'Scheduled', source: 'servicenow', createdAt: Date.now() - 86400000, updatedAt: Date.now() },
    ];
  }
}
