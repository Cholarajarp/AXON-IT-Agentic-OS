export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SecurityCategory = 'secret' | 'dependency' | 'database' | 'auth' | 'code' | 'publish';

export interface SecurityScanFile {
  path: string;
  content: string;
}

export interface SecurityFinding {
  id: string;
  severity: SecuritySeverity;
  category: SecurityCategory;
  title: string;
  detail: string;
  filePath?: string;
  line?: number;
  excerpt?: string;
  recommendation: string;
  blocksPublish: boolean;
}

export interface SecurityScanInput {
  files?: SecurityScanFile[];
  workspacePath?: string;
  maxFiles?: number;
}

export interface SecurityScanResult {
  id: string;
  score: number;
  status: 'safe-to-preview' | 'needs-review' | 'blocked';
  summary: string;
  scannedFiles: number;
  findings: SecurityFinding[];
  publishGates: Array<{
    id: string;
    title: string;
    passed: boolean;
    evidence: string[];
  }>;
  categories: Record<SecurityCategory, number>;
  createdAt: string;
}
