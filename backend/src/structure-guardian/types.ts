export type StructureSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type StructureAction = 'keep' | 'ignore' | 'archive' | 'migrate' | 'delete' | 'review';
export type StructureCategory =
  | 'canonical-root'
  | 'duplicate-config'
  | 'legacy-source'
  | 'generated-artifact'
  | 'local-state'
  | 'missing-capability'
  | 'governance';

export interface DuplicateConfig {
  fileName: string;
  rootPath: string;
  duplicatePath: string;
  status: 'same' | 'different' | 'missing-root' | 'missing-duplicate';
  recommendation: string;
}

export interface StructureFinding {
  id: string;
  severity: StructureSeverity;
  category: StructureCategory;
  action: StructureAction;
  title: string;
  detail: string;
  path?: string;
  recommendation: string;
  blocksCleanup: boolean;
}

export interface LegacyComparison {
  enabled: boolean;
  legacyRoot?: string;
  summary: string;
  exactDuplicateCount: number;
  driftedSharedCount: number;
  legacyOnlyCount: number;
  rootOnlyCount: number;
  ignoredDirectories: string[];
  exactDuplicateFiles: Array<{
    path: string;
    bytes: number;
    recommendation: string;
  }>;
  driftedSharedFiles: Array<{
    path: string;
    rootBytes: number;
    legacyBytes: number;
    recommendation: string;
  }>;
  legacyOnlyFiles: Array<{
    path: string;
    bytes: number;
    recommendation: string;
  }>;
}

export interface StructureScanInput {
  workspacePath?: string;
  includeNested?: boolean;
}

export interface StructureScanResult {
  id: string;
  workspaceRoot: string;
  canonicalRoot: string;
  score: number;
  status: 'clean' | 'needs-review' | 'blocked';
  summary: string;
  validKeepPaths: Array<{
    path: string;
    reason: string;
    ownerAgent: string;
  }>;
  cleanupCandidates: Array<{
    path: string;
    action: StructureAction;
    reason: string;
    safeCommand?: string;
  }>;
  duplicateConfigs: DuplicateConfig[];
  legacyComparison: LegacyComparison;
  findings: StructureFinding[];
  migrationPlan: Array<{
    order: number;
    ownerAgent: string;
    action: string;
    evidence: string[];
  }>;
  missingEnterpriseCapabilities: Array<{
    id: string;
    capability: string;
    whyItMatters: string;
    buildNext: string;
  }>;
  createdAt: string;
}
