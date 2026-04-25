export type IntegrationType = 'servicenow' | 'jira' | 'pagerduty' | 'datadog' | 'slack' | 'github' | 'gitlab' | 'aws' | 'azure' | 'gcp';

export interface IntegrationConfig {
  type: IntegrationType;
  name: string;
  baseUrl: string;
  credentials: {
    type: 'api_key' | 'oauth2' | 'basic' | 'token';
    token?: string;
    clientId?: string;
    clientSecret?: string;
    username?: string;
    password?: string;
  };
  enabled: boolean;
  tenantId: string;
  metadata?: Record<string, unknown>;
}

export interface IntegrationEvent {
  id: string;
  source: IntegrationType;
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  processed: boolean;
}

export interface ITSMTicket {
  id: string;
  externalId: string;
  type: 'incident' | 'problem' | 'change' | 'service_request';
  title: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  status: string;
  assignee?: string;
  source: IntegrationType;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

export interface IntegrationConnector {
  type: IntegrationType;
  name: string;
  connect(config: IntegrationConfig): Promise<boolean>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<boolean>;
  createTicket(ticket: Partial<ITSMTicket>): Promise<ITSMTicket>;
  updateTicket(id: string, updates: Partial<ITSMTicket>): Promise<ITSMTicket>;
  getTicket(id: string): Promise<ITSMTicket | null>;
  listTickets(filter?: Record<string, unknown>): Promise<ITSMTicket[]>;
  sendNotification?(message: string, channel?: string): Promise<boolean>;
}
