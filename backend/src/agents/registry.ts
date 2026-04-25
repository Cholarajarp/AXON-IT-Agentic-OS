import type { BaseAgent, AgentMetrics } from './types.js';
import { IntentAgent } from './implementations/intent.js';
import { BusinessAnalystAgent } from './implementations/business-analyst.js';
import { DomainAgent } from './implementations/domain.js';
import { SolutionArchitectAgent } from './implementations/solution-architect.js';
import { EngineeringAgent } from './implementations/engineering.js';
import { QAAgent } from './implementations/qa.js';
import { SecurityAgent } from './implementations/security.js';
import { InfrastructureAgent } from './implementations/infrastructure.js';
import { ReleaseAgent } from './implementations/release.js';
import { SREAgent } from './implementations/sre.js';
import { ComplianceAgent } from './implementations/compliance.js';
import { DocumentationAgent } from './implementations/documentation.js';
import { PMOAgent } from './implementations/pmo.js';
import { ExecutiveInsightAgent } from './implementations/executive-insight.js';
import { StackResearchAgent } from './implementations/stack-research.js';
import { DatabaseArchitectAgent } from './implementations/database-architect.js';
import { MigrationSafetyAgent } from './implementations/migration-safety.js';
import { DataQualityAgent } from './implementations/data-quality.js';
import { FinOpsAgent } from './implementations/finops.js';
import { AgenticCoordinatorAgent } from './implementations/agentic-coordinator.js';
import { CriticAgent } from './implementations/critic.js';

class AgentRegistry {
  private agents = new Map<string, BaseAgent>();
  private metrics = new Map<string, AgentMetrics>();

  constructor() {
    this.registerAll();
  }

  private registerAll() {
    const agents: BaseAgent[] = [
      new IntentAgent(),
      new BusinessAnalystAgent(),
      new DomainAgent(),
      new SolutionArchitectAgent(),
      new EngineeringAgent(),
      new QAAgent(),
      new SecurityAgent(),
      new InfrastructureAgent(),
      new ReleaseAgent(),
      new SREAgent(),
      new ComplianceAgent(),
      new DocumentationAgent(),
      new PMOAgent(),
      new ExecutiveInsightAgent(),
      new StackResearchAgent(),
      new DatabaseArchitectAgent(),
      new MigrationSafetyAgent(),
      new DataQualityAgent(),
      new FinOpsAgent(),
      new AgenticCoordinatorAgent(),
      new CriticAgent(),
    ];

    for (const agent of agents) {
      this.agents.set(agent.name, agent);
      this.metrics.set(agent.name, {
        totalExecutions: 0,
        successCount: 0,
        failureCount: 0,
        avgDurationMs: 0,
        avgCost: 0,
      });
    }
  }

  get(name: string): BaseAgent {
    const agent = this.agents.get(name);
    if (!agent) {
      throw new Error(`Agent not found: ${name}. Available: ${Array.from(this.agents.keys()).join(', ')}`);
    }
    return agent;
  }

  getAll(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  getMetrics(name: string): AgentMetrics | undefined {
    return this.metrics.get(name);
  }

  getAllMetrics(): Map<string, AgentMetrics> {
    return this.metrics;
  }

  recordExecution(name: string, durationMs: number, cost: number, success: boolean) {
    const m = this.metrics.get(name);
    if (!m) return;
    m.totalExecutions++;
    if (success) m.successCount++;
    else m.failureCount++;
    m.avgDurationMs = (m.avgDurationMs * (m.totalExecutions - 1) + durationMs) / m.totalExecutions;
    m.avgCost = (m.avgCost * (m.totalExecutions - 1) + cost) / m.totalExecutions;
    m.lastExecutedAt = Date.now();
  }

  has(name: string): boolean {
    return this.agents.has(name);
  }

  list(): Array<{ name: string; description: string; version: string; capabilities: string[] }> {
    return Array.from(this.agents.values()).map((a) => ({
      name: a.name,
      description: a.description,
      version: a.version,
      capabilities: a.capabilities,
    }));
  }
}

export const agentRegistry = new AgentRegistry();
