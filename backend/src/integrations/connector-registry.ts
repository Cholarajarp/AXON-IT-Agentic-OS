import type { IntegrationConfig, IntegrationConnector, IntegrationType, ITSMTicket } from './types.js';
import { DurableJsonStore } from '../services/durable-json-store.js';
import { ServiceNowConnector } from './connectors/servicenow.js';
import { JiraConnector } from './connectors/jira.js';
import { PagerDutyConnector } from './connectors/pagerduty.js';
import { DatadogConnector } from './connectors/datadog.js';
import { SlackConnector } from './connectors/slack.js';
import { GitHubConnector } from './connectors/github.js';

const CONNECTOR_METADATA: Partial<Record<IntegrationType, {
  category: string;
  scopes: string[];
  setupHint: string;
  productionNote: string;
}>> = {
  servicenow: {
    category: 'ITSM',
    scopes: ['incidents', 'changes', 'service_requests'],
    setupHint: 'Add a ServiceNow instance URL and integration token.',
    productionNote: 'Use OAuth and table ACLs before enabling write actions.',
  },
  jira: {
    category: 'Planning',
    scopes: ['issues', 'projects', 'service_desk'],
    setupHint: 'Add the Jira Cloud base URL and API token.',
    productionNote: 'Map AXON priorities to project-specific workflows.',
  },
  pagerduty: {
    category: 'Incident',
    scopes: ['incidents', 'escalations', 'on_call'],
    setupHint: 'Add PagerDuty API URL and token.',
    productionNote: 'Use routing keys and escalation policies per tenant.',
  },
  datadog: {
    category: 'Observability',
    scopes: ['monitors', 'metrics', 'logs'],
    setupHint: 'Add Datadog site URL and API/app token.',
    productionNote: 'Restrict monitor mutation behind approval gates.',
  },
  slack: {
    category: 'Collaboration',
    scopes: ['channels', 'messages', 'approvals'],
    setupHint: 'Add Slack API URL and bot token.',
    productionNote: 'Use signed webhook verification and scoped bot permissions.',
  },
  github: {
    category: 'Code',
    scopes: ['issues', 'pull_requests', 'checks'],
    setupHint: 'Add GitHub API URL and fine-grained token or app token.',
    productionNote: 'Prefer GitHub App installation tokens for enterprise use.',
  },
};

export type ConnectorRuntimeStatus = 'needs-config' | 'disabled' | 'configured' | 'connected' | 'degraded';

export interface ConnectorStatus {
  type: string;
  name: string;
  category: string;
  configured: boolean;
  enabled: boolean;
  healthy: boolean;
  status: ConnectorRuntimeStatus;
  lastChecked: string;
  baseUrl?: string;
  scopes: string[];
  setupHint: string;
  productionNote: string;
}

class ConnectorRegistry {
  private connectors = new Map<string, IntegrationConnector>();
  private configs = new Map<string, IntegrationConfig>();
  private configsHydrated = false;
  private readonly configStore = new DurableJsonStore<IntegrationConfig[]>('integrations/configs.json', []);

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    const defaults: IntegrationConnector[] = [
      new ServiceNowConnector(),
      new JiraConnector(),
      new PagerDutyConnector(),
      new DatadogConnector(),
      new SlackConnector(),
      new GitHubConnector(),
    ];
    for (const connector of defaults) {
      this.connectors.set(connector.type, connector);
    }
  }

  async configure(config: IntegrationConfig): Promise<boolean> {
    this.hydrateConfigs();
    const connector = this.connectors.get(config.type);
    if (!connector) return false;
    this.configs.set(config.type, config);
    this.persistConfigs();
    if (config.enabled) {
      return connector.connect(config);
    }
    return true;
  }

  get(type: IntegrationType): IntegrationConnector | undefined {
    this.hydrateConfigs();
    return this.connectors.get(type);
  }

  getConfig(type: IntegrationType): IntegrationConfig | undefined {
    this.hydrateConfigs();
    return this.configs.get(type);
  }

  async createTicket(type: IntegrationType, ticket: Partial<ITSMTicket>): Promise<ITSMTicket | null> {
    this.hydrateConfigs();
    const connector = this.connectors.get(type);
    if (!connector) return null;
    return connector.createTicket(ticket);
  }

  async healthCheckAll(): Promise<Record<string, boolean>> {
    this.hydrateConfigs();
    const results: Record<string, boolean> = {};
    for (const [type, connector] of this.connectors) {
      try {
        results[type] = await connector.healthCheck();
      } catch {
        results[type] = false;
      }
    }
    return results;
  }

  async listConnectorStatus(): Promise<ConnectorStatus[]> {
    this.hydrateConfigs();
    const checkedAt = new Date().toISOString();
    const statuses: ConnectorStatus[] = [];

    for (const connector of this.connectors.values()) {
      const config = this.configs.get(connector.type);
      // Existing connector adapters can accept configuration, but they do not
      // yet perform vendor-specific external verification. Keep the public
      // status honest: configured is not the same thing as connected.
      const healthy = false;

      const metadata = CONNECTOR_METADATA[connector.type] ?? {
        category: 'External system',
        scopes: ['read'],
        setupHint: 'Configure endpoint and credentials.',
        productionNote: 'Verify least-privilege permissions before enabling writes.',
      };

      const status: ConnectorRuntimeStatus = !config
        ? 'needs-config'
        : !config.enabled
          ? 'disabled'
          : 'configured';

      statuses.push({
        type: connector.type,
        name: connector.name,
        category: metadata.category,
        configured: Boolean(config),
        enabled: config?.enabled ?? false,
        healthy,
        status,
        lastChecked: checkedAt,
        baseUrl: config?.baseUrl,
        scopes: metadata.scopes,
        setupHint: metadata.setupHint,
        productionNote: metadata.productionNote,
      });
    }

    return statuses;
  }

  listConnectors(): Array<{ type: string; name: string; configured: boolean; enabled: boolean }> {
    this.hydrateConfigs();
    return Array.from(this.connectors.values()).map((c) => {
      const config = this.configs.get(c.type);
      return {
        type: c.type,
        name: c.name,
        configured: !!config,
        enabled: config?.enabled ?? false,
      };
    });
  }

  isKnownType(type: string): type is IntegrationType {
    return this.connectors.has(type);
  }

  private hydrateConfigs(): void {
    if (this.configsHydrated) return;
    for (const config of this.configStore.read()) {
      const connector = this.connectors.get(config.type);
      if (!connector) continue;
      this.configs.set(config.type, config);
      if (config.enabled) {
        void connector.connect(config).catch(() => undefined);
      }
    }
    this.configsHydrated = true;
  }

  private persistConfigs(): void {
    this.configStore.write(Array.from(this.configs.values()).map(toPersistedConfig));
  }
}

export const connectorRegistry = new ConnectorRegistry();

function toPersistedConfig(config: IntegrationConfig): IntegrationConfig {
  return {
    ...config,
    credentials: { type: config.credentials.type },
    metadata: { ...config.metadata, credentialsPersisted: false },
  };
}
