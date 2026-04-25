import type { AgentProjectExecution, AgentProjectWorkspacePlan } from '../types.js';

export interface PackagingRuntime {
  listExecutions(runId?: string): AgentProjectExecution[];
  listWorkspacePlans(runId?: string): AgentProjectWorkspacePlan[];
}
