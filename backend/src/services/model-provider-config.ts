import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type ConfigurableProvider = 'anthropic' | 'openai' | 'google' | 'bedrock' | 'ollama' | 'vllm';

export interface ProviderConfigInput {
  provider: ConfigurableProvider;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  modelIds?: Record<string, string>;
}

export interface SavedProviderConfig extends ProviderConfigInput {
  configuredAt: string;
  updatedAt: string;
  secretMode: 'encrypted' | 'local-obfuscated';
}

export interface PublicProviderConfig {
  provider: ConfigurableProvider;
  enabled: boolean;
  configuredAt: string;
  updatedAt: string;
  secretMode: SavedProviderConfig['secretMode'];
  apiKeyMasked?: string;
  accessKeyIdMasked?: string;
  secretAccessKeyMasked?: string;
  sessionTokenMasked?: string;
  baseUrl?: string;
  region?: string;
  modelIds?: Record<string, string>;
}

type StoredProviderConfig = Omit<SavedProviderConfig, 'apiKey' | 'accessKeyId' | 'secretAccessKey' | 'sessionToken'> & {
  secrets: Record<string, string>;
};

const SECRET_FIELDS = ['apiKey', 'accessKeyId', 'secretAccessKey', 'sessionToken'] as const;

class ModelProviderConfigStore {
  private readonly stateDir = path.resolve(process.env.AXON_LOCAL_STATE_DIR || path.join(process.cwd(), '.axon'));
  private readonly filePath = path.join(this.stateDir, 'model-providers.json');

  async listPublic(): Promise<PublicProviderConfig[]> {
    const configs = await this.readAll();
    return configs.map((config) => this.toPublic(config));
  }

  async listPrivate(): Promise<SavedProviderConfig[]> {
    const stored = await this.readStored();
    return stored.map((config) => this.fromStored(config));
  }

  async upsert(input: ProviderConfigInput): Promise<SavedProviderConfig> {
    const existing = (await this.readStored()).filter((config) => config.provider !== input.provider);
    const previous = (await this.readAll()).find((config) => config.provider === input.provider);
    const now = new Date().toISOString();
    const merged: SavedProviderConfig = {
      provider: input.provider,
      enabled: input.enabled,
      apiKey: input.apiKey || previous?.apiKey,
      baseUrl: input.baseUrl ?? previous?.baseUrl,
      region: input.region ?? previous?.region,
      accessKeyId: input.accessKeyId || previous?.accessKeyId,
      secretAccessKey: input.secretAccessKey || previous?.secretAccessKey,
      sessionToken: input.sessionToken || previous?.sessionToken,
      modelIds: input.modelIds ?? previous?.modelIds,
      configuredAt: previous?.configuredAt ?? now,
      updatedAt: now,
      secretMode: process.env.AXON_CONFIG_SECRET ? 'encrypted' : 'local-obfuscated',
    };

    await this.writeStored([...existing, this.toStored(merged)]);
    return merged;
  }

  async remove(provider: ConfigurableProvider): Promise<boolean> {
    const configs = await this.readStored();
    const next = configs.filter((config) => config.provider !== provider);
    await this.writeStored(next);
    return next.length !== configs.length;
  }

  toPublic(config: SavedProviderConfig): PublicProviderConfig {
    return {
      provider: config.provider,
      enabled: config.enabled,
      configuredAt: config.configuredAt,
      updatedAt: config.updatedAt,
      secretMode: config.secretMode,
      apiKeyMasked: maskSecret(config.apiKey),
      accessKeyIdMasked: maskSecret(config.accessKeyId),
      secretAccessKeyMasked: maskSecret(config.secretAccessKey),
      sessionTokenMasked: maskSecret(config.sessionToken),
      baseUrl: config.baseUrl,
      region: config.region,
      modelIds: config.modelIds,
    };
  }

  private async readAll(): Promise<SavedProviderConfig[]> {
    return (await this.readStored()).map((config) => this.fromStored(config));
  }

  private async readStored(): Promise<StoredProviderConfig[]> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      return JSON.parse(raw) as StoredProviderConfig[];
    } catch {
      return [];
    }
  }

  private async writeStored(configs: StoredProviderConfig[]): Promise<void> {
    await mkdir(this.stateDir, { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(configs, null, 2)}\n`, 'utf8');
  }

  private toStored(config: SavedProviderConfig): StoredProviderConfig {
    const secrets: Record<string, string> = {};
    for (const field of SECRET_FIELDS) {
      const value = config[field];
      if (value) secrets[field] = protectSecret(value);
    }

    return {
      provider: config.provider,
      enabled: config.enabled,
      baseUrl: config.baseUrl,
      region: config.region,
      modelIds: config.modelIds,
      configuredAt: config.configuredAt,
      updatedAt: config.updatedAt,
      secretMode: config.secretMode,
      secrets,
    };
  }

  private fromStored(config: StoredProviderConfig): SavedProviderConfig {
    const secrets: Partial<Record<(typeof SECRET_FIELDS)[number], string>> = {};
    for (const field of SECRET_FIELDS) {
      const value = config.secrets[field];
      if (value) secrets[field] = unprotectSecret(value, config.secretMode);
    }

    return {
      ...config,
      ...secrets,
    };
  }
}

function protectSecret(value: string): string {
  const secret = process.env.AXON_CONFIG_SECRET;
  if (!secret) return Buffer.from(value, 'utf8').toString('base64');

  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

function unprotectSecret(value: string, mode: SavedProviderConfig['secretMode']): string {
  if (mode === 'local-obfuscated') return Buffer.from(value, 'base64').toString('utf8');
  const secret = process.env.AXON_CONFIG_SECRET;
  if (!secret) throw new Error('AXON_CONFIG_SECRET is required to decrypt provider credentials');

  const [ivRaw, tagRaw, encryptedRaw] = value.split('.');
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error('Invalid encrypted provider secret');

  const key = createHash('sha256').update(secret).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function maskSecret(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.length <= 8) return '••••';
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export const modelProviderConfigStore = new ModelProviderConfigStore();
