export type ArtifactKind =
  | 'release-pack'
  | 'browser-trace'
  | 'screenshot'
  | 'security-report'
  | 'database-report'
  | 'customer-report'
  | 'api-package'
  | 'deployment-manifest'
  | 'generic';

export interface ArtifactInput {
  tenantId?: string;
  kind: ArtifactKind;
  name: string;
  content: string | Record<string, unknown>;
  contentType?: string;
  metadata?: Record<string, unknown>;
}

export interface ArtifactRecord {
  id: string;
  tenantId: string;
  kind: ArtifactKind;
  name: string;
  uri: string;
  sha256: string;
  bytes: number;
  contentType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ArtifactStoreHealth {
  driver: 'local' | 's3-compatible';
  writable: boolean;
  root: string;
  mode: 'development' | 'production';
  warnings: string[];
}
