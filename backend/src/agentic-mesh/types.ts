export type MeshTopology =
  | 'hierarchical'
  | 'sequential-pipeline'
  | 'parallel-fanout'
  | 'loop-critic'
  | 'human-gated';

export type MeshStageStatus = 'planned' | 'ready' | 'blocked';

export interface AgenticMeshInput {
  tenantId?: string;
  mission: string;
  goal?: string;
  regulated?: boolean;
  maxIterations?: number;
  autonomyLevel?: 'assistive' | 'supervised' | 'autonomous';
  budgetUsd?: number;
  preferredTopologies?: MeshTopology[];
}

export interface MeshAgentRole {
  agent: string;
  role: 'coordinator' | 'planner' | 'researcher' | 'builder' | 'critic' | 'operator' | 'customer';
  responsibilities: string[];
  inputChannels: string[];
  outputChannels: string[];
  modelPolicy: string;
  canRunInParallel: boolean;
}

export interface MeshTaskEnvelope {
  id: string;
  protocol: 'AXON-A2A';
  senderAgent: string;
  receiverAgent: string;
  task: string;
  expectedArtifacts: string[];
  status: 'created' | 'delegated' | 'waiting' | 'completed';
  securityContext: {
    tenantScoped: boolean;
    dataClass: 'public' | 'internal' | 'confidential' | 'restricted';
    requiredScopes: string[];
  };
}

export interface MeshExecutionStage {
  order: number;
  name: string;
  topology: MeshTopology;
  leadAgent: string;
  agents: string[];
  objective: string;
  dependsOn: number[];
  status: MeshStageStatus;
  sharedStateKeys: string[];
  qualityGate: string;
  costControl: string;
  failurePolicy: string;
  expectedArtifacts: string[];
}

export interface MeshQualityLoop {
  id: string;
  trigger: string;
  generatorAgent: string;
  criticAgent: string;
  maxIterations: number;
  stopCondition: string;
  evidence: string[];
}

export interface AgenticMeshBlueprint {
  id: string;
  tenantId: string;
  mission: string;
  generatedAt: string;
  autonomyLevel: AgenticMeshInput['autonomyLevel'];
  topologies: MeshTopology[];
  finOpsReportId: string;
  summary: string;
  agentRoles: MeshAgentRole[];
  stages: MeshExecutionStage[];
  taskEnvelopes: MeshTaskEnvelope[];
  qualityLoops: MeshQualityLoop[];
  sharedState: Array<{ key: string; ownerAgent: string; retention: string; purpose: string }>;
  humanGates: Array<{ gate: string; owner: string; reason: string; unblockCondition: string }>;
  operatingRules: string[];
  score: {
    autonomy: number;
    reliability: number;
    costDiscipline: number;
    enterpriseReadiness: number;
  };
  nextActions: string[];
}
