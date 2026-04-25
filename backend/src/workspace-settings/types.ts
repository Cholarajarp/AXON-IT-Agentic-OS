export interface WorkspaceIdentitySettings {
  name: string;
  tenantId: string;
  region: string;
  timezone: string;
}

export interface WorkspaceSecuritySettings {
  requireSso: boolean;
  twoFactorAuth: boolean;
  tamperEvidentAuditLog: boolean;
  encryptedProviderStorage: boolean;
}

export interface WorkspaceNotificationSettings {
  emailDigests: boolean;
  slackAlerts: boolean;
  pushToMobile: boolean;
}

export interface WorkspaceSettingsRuntime {
  backendConnected: boolean;
  providerSecretMode: 'encrypted' | 'local-obfuscated';
  auditSigningConfigured: boolean;
  kmsSigningConfigured: boolean;
  ssoConfigured: boolean;
}

export interface WorkspaceSettings {
  workspace: WorkspaceIdentitySettings;
  security: WorkspaceSecuritySettings;
  notifications: WorkspaceNotificationSettings;
  runtime: WorkspaceSettingsRuntime;
  updatedAt: string;
}

export interface WorkspaceSettingsUpdate {
  workspace?: Partial<WorkspaceIdentitySettings>;
  security?: Partial<WorkspaceSecuritySettings>;
  notifications?: Partial<WorkspaceNotificationSettings>;
}
