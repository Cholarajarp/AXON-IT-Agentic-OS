import { DurableJsonStore } from '../services/durable-json-store.js';
import type { WorkspaceSettings, WorkspaceSettingsRuntime, WorkspaceSettingsUpdate } from './types.js';

type StoredWorkspaceSettings = Omit<WorkspaceSettings, 'runtime'>;

const now = new Date().toISOString();
const fallbackSettings: StoredWorkspaceSettings = {
  workspace: {
    name: 'AXON IT Agentic AI OS',
    tenantId: 'tenant_default',
    region: process.env.AXON_REGION || 'ap-south-1',
    timezone: process.env.TZ || 'Asia/Kolkata',
  },
  security: {
    requireSso: false,
    twoFactorAuth: true,
    tamperEvidentAuditLog: true,
    encryptedProviderStorage: Boolean(process.env.AXON_CONFIG_SECRET),
  },
  notifications: {
    emailDigests: true,
    slackAlerts: false,
    pushToMobile: false,
  },
  updatedAt: now,
};

const settingsStore = new DurableJsonStore<StoredWorkspaceSettings>('settings/workspace-settings.json', fallbackSettings);
let settings = sanitizeSettings(settingsStore.read());

export class WorkspaceSettingsService {
  get(): WorkspaceSettings {
    return withRuntime(settings);
  }

  update(input: WorkspaceSettingsUpdate): WorkspaceSettings {
    settings = sanitizeSettings({
      workspace: {
        ...settings.workspace,
        ...input.workspace,
      },
      security: {
        ...settings.security,
        ...input.security,
      },
      notifications: {
        ...settings.notifications,
        ...input.notifications,
      },
      updatedAt: new Date().toISOString(),
    });
    settingsStore.write(settings);
    return withRuntime(settings);
  }
}

function sanitizeSettings(value: StoredWorkspaceSettings): StoredWorkspaceSettings {
  return {
    workspace: {
      name: value.workspace?.name?.trim() || fallbackSettings.workspace.name,
      tenantId: value.workspace?.tenantId?.trim() || fallbackSettings.workspace.tenantId,
      region: value.workspace?.region?.trim() || fallbackSettings.workspace.region,
      timezone: value.workspace?.timezone?.trim() || fallbackSettings.workspace.timezone,
    },
    security: {
      requireSso: Boolean(value.security?.requireSso),
      twoFactorAuth: value.security?.twoFactorAuth ?? true,
      tamperEvidentAuditLog: value.security?.tamperEvidentAuditLog ?? true,
      encryptedProviderStorage: Boolean(value.security?.encryptedProviderStorage),
    },
    notifications: {
      emailDigests: value.notifications?.emailDigests ?? true,
      slackAlerts: Boolean(value.notifications?.slackAlerts),
      pushToMobile: Boolean(value.notifications?.pushToMobile),
    },
    updatedAt: value.updatedAt || new Date().toISOString(),
  };
}

function withRuntime(value: StoredWorkspaceSettings): WorkspaceSettings {
  return {
    ...value,
    runtime: runtimeStatus(),
  };
}

function runtimeStatus(): WorkspaceSettingsRuntime {
  return {
    backendConnected: true,
    providerSecretMode: process.env.AXON_CONFIG_SECRET ? 'encrypted' : 'local-obfuscated',
    auditSigningConfigured: Boolean(process.env.AXON_LEDGER_SIGNING_KEY),
    kmsSigningConfigured: Boolean(process.env.AXON_KMS_KEY_ID || process.env.AWS_KMS_KEY_ID),
    ssoConfigured: Boolean(process.env.AXON_SSO_ISSUER_URL || process.env.OIDC_ISSUER_URL),
  };
}

export const workspaceSettings = new WorkspaceSettingsService();
