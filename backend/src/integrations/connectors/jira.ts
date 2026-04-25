import { nanoid } from 'nanoid';
import type { IntegrationConfig, IntegrationConnector, ITSMTicket } from '../types.js';

export class JiraConnector implements IntegrationConnector {
  type = 'jira' as const;
  name = 'Jira Service Management';
  private config?: IntegrationConfig;
  private connected = false;

  async connect(config: IntegrationConfig): Promise<boolean> { this.config = config; this.connected = !!this.config; return true; }
  async disconnect() { this.connected = false; }
  async healthCheck(): Promise<boolean> { return this.connected; }

  async createTicket(ticket: Partial<ITSMTicket>): Promise<ITSMTicket> {
    const key = `SUTR-${Math.floor(Math.random() * 9000) + 1000}`;
    return {
      id: nanoid(12),
      externalId: key,
      type: ticket.type || 'service_request',
      title: ticket.title || 'Untitled',
      description: ticket.description || '',
      priority: ticket.priority || 'P2',
      status: 'To Do',
      assignee: ticket.assignee,
      source: 'jira',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: { project: 'SUTR', issueType: ticket.type === 'incident' ? 'Bug' : 'Task' },
    };
  }

  async updateTicket(id: string, updates: Partial<ITSMTicket>): Promise<ITSMTicket> {
    return { id, externalId: id, type: 'service_request', title: updates.title || '', description: '', priority: 'P2', status: updates.status || 'In Progress', source: 'jira', createdAt: Date.now(), updatedAt: Date.now() };
  }

  async getTicket(id: string): Promise<ITSMTicket | null> {
    return { id, externalId: id, type: 'service_request', title: 'Jira Issue', description: '', priority: 'P2', status: 'Open', source: 'jira', createdAt: Date.now() - 3600000, updatedAt: Date.now() };
  }

  async listTickets(): Promise<ITSMTicket[]> {
    return [
      { id: '1', externalId: 'SUTR-1234', type: 'service_request', title: 'Implement SSO for enterprise tenants', description: '', priority: 'P2', status: 'In Progress', source: 'jira', createdAt: Date.now() - 172800000, updatedAt: Date.now() },
      { id: '2', externalId: 'SUTR-1235', type: 'incident', title: 'Webhook delivery failures', description: '', priority: 'P1', status: 'To Do', source: 'jira', createdAt: Date.now() - 43200000, updatedAt: Date.now() },
    ];
  }
}
