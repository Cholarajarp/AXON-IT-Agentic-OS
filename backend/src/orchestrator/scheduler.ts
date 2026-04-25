import { nanoid } from 'nanoid';
import type { TaskDAG, TaskNode, ExecutionContext } from './types.js';
import { planner } from './planner.js';
import { executeWithRuntimeEnforcement } from '../agents/pipeline.js';
import { broadcastUpdate } from '../ws/gateway.js';
import { sql } from '../db/connection.js';

type PipelineSensitivity = 'public' | 'internal' | 'confidential' | 'restricted';

interface RunningTask {
  nodeId: string;
  workflowId: string;
  abortController: AbortController;
  startedAt: number;
}

class Scheduler {
  private dags = new Map<string, TaskDAG>();
  private contexts = new Map<string, ExecutionContext>();
  private running = new Map<string, RunningTask>();
  private tickInterval: NodeJS.Timeout | null = null;

  start() {
    if (this.tickInterval) return;
    this.tickInterval = setInterval(() => this.tick(), 2000);
  }

  stop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    for (const task of this.running.values()) {
      task.abortController.abort();
    }
    this.running.clear();
  }

  async submitWorkflow(workflowId: string, goal: string, domain: string[], budget: number): Promise<TaskDAG> {
    const dag = planner.plan({ workflowId, goal, domain });
    this.dags.set(workflowId, dag);
    this.contexts.set(workflowId, {
      workflowId,
      tenantId: 'default',
      dag,
      variables: {},
      costAccumulated: 0,
      costBudget: budget,
    });

    broadcastUpdate('workflow.state', { workflowId, state: 'RUNNING', progress: 0 });
    this.start();
    return dag;
  }

  getDAG(workflowId: string): TaskDAG | undefined {
    return this.dags.get(workflowId);
  }

  getContext(workflowId: string): ExecutionContext | undefined {
    return this.contexts.get(workflowId);
  }

  cancelWorkflow(workflowId: string) {
    const dag = this.dags.get(workflowId);
    if (!dag) return;

    for (const [key, task] of this.running.entries()) {
      if (task.workflowId === workflowId) {
        task.abortController.abort();
        this.running.delete(key);
      }
    }

    for (const node of dag.nodes) {
      if (node.state === 'RUNNING' || node.state === 'READY' || node.state === 'PENDING') {
        node.state = 'SKIPPED';
      }
    }

    this.dags.set(workflowId, { ...dag, updatedAt: Date.now() });
    broadcastUpdate('workflow.state', { workflowId, state: 'CANCELLED', progress: planner.getProgress(dag) });
  }

  private async tick() {
    for (const [workflowId, dag] of this.dags.entries()) {
      if (planner.isComplete(dag)) {
        this.finalizeWorkflow(workflowId, dag);
        continue;
      }

      const advanced = planner.advanceDAG(dag);
      this.dags.set(workflowId, advanced);

      const readyTasks = advanced.nodes.filter((n) => n.state === 'READY');
      for (const task of readyTasks) {
        if (this.running.has(task.id)) continue;
        if (task.approvalRequired) {
          task.state = 'BLOCKED';
          await this.createApproval(workflowId, task);
          broadcastUpdate('task.state', { workflowId, taskId: task.id, state: 'BLOCKED', reason: 'approval_required' });
          continue;
        }
        this.executeTask(workflowId, task);
      }
    }
  }

  private async executeTask(workflowId: string, node: TaskNode) {
    const context = this.contexts.get(workflowId);
    if (!context) return;

    if (context.costAccumulated >= context.costBudget) {
      node.state = 'BLOCKED';
      broadcastUpdate('task.state', { workflowId, taskId: node.id, state: 'BLOCKED', reason: 'budget_exceeded' });
      return;
    }

    node.state = 'RUNNING';
    node.startedAt = Date.now();

    const abortController = new AbortController();
    this.running.set(node.id, { nodeId: node.id, workflowId, abortController, startedAt: Date.now() });

    broadcastUpdate('task.state', { workflowId, taskId: node.id, state: 'RUNNING', agent: node.agent });

    try {
      // Every agent execution goes through the 13-step policy-bound pipeline.
      const pipelineResult = await executeWithRuntimeEnforcement({
        workflowId,
        taskId: node.id,
        taskName: node.name,
        description: node.description,
        agentName: node.agent,
        tenantId: context.tenantId,
        input: { ...node.input, ...context.variables },
        signal: abortController.signal,
        sensitivityLevel: (context.variables.sensitivityLevel as PipelineSensitivity) ?? 'internal',
        sovereignMode: Boolean(context.variables.sovereignMode),
        costBudget: context.costBudget,
        costSpent: context.costAccumulated,
        approvalApproved: true, // If we got here the task was not approvalRequired, or approval already resolved
      });

      if (!pipelineResult.success || !pipelineResult.agentResult) {
        throw new Error(pipelineResult.abortReason || 'Pipeline failed without agent result');
      }

      const result = pipelineResult.agentResult;
      node.state = 'COMPLETE';
      node.completedAt = Date.now();
      node.output = result.output;
      node.cost = pipelineResult.cost;

      context.costAccumulated += pipelineResult.cost;
      if (result.variables) {
        Object.assign(context.variables, result.variables);
      }

      broadcastUpdate('task.state', {
        workflowId,
        taskId: node.id,
        state: 'COMPLETE',
        output: result.output,
        executionId: pipelineResult.executionId,
        stepsRun: pipelineResult.steps.length,
      });
      broadcastUpdate('cost.record', { workflowId, taskId: node.id, cost: pipelineResult.cost, agent: node.agent });

      await this.updateWorkflowProgress(workflowId);
    } catch (err) {
      const error = err as Error;
      if (error.name === 'AbortError') return;

      node.retries++;
      if (node.retries < node.maxRetries) {
        node.state = 'READY';
        broadcastUpdate('task.state', { workflowId, taskId: node.id, state: 'READY', retry: node.retries });
      } else {
        node.state = 'FAILED';
        node.error = error.message;
        broadcastUpdate('task.state', { workflowId, taskId: node.id, state: 'FAILED', error: error.message });
      }
    } finally {
      this.running.delete(node.id);
    }
  }

  private async updateWorkflowProgress(workflowId: string) {
    const dag = this.dags.get(workflowId);
    if (!dag) return;
    const progress = planner.getProgress(dag);
    const currentNode = dag.nodes.find((n) => n.state === 'RUNNING') || dag.nodes.find((n) => n.state === 'READY');

    try {
      await sql`
        UPDATE workflows SET
          progress = ${progress},
          step = ${currentNode?.name || 'Processing'},
          agent = ${currentNode?.agent || 'Scheduler'},
          cost = ${this.contexts.get(workflowId)?.costAccumulated || 0},
          state = 'RUNNING',
          updated_at = NOW()
        WHERE id = ${workflowId}
      `;
    } catch {
      // DB may not be available in test mode
    }

    broadcastUpdate('workflow.state', { workflowId, state: 'RUNNING', progress, step: currentNode?.name });
  }

  private async finalizeWorkflow(workflowId: string, dag: TaskDAG) {
    const hasFailed = dag.nodes.some((n) => n.state === 'FAILED');
    const finalState = hasFailed ? 'FAILED' : 'COMPLETE';
    const progress = planner.getProgress(dag);

    try {
      await sql`
        UPDATE workflows SET
          state = ${finalState},
          progress = ${progress},
          step = ${hasFailed ? 'Failed' : 'Complete'},
          cost = ${this.contexts.get(workflowId)?.costAccumulated || 0},
          updated_at = NOW()
        WHERE id = ${workflowId}
      `;
    } catch {
      // DB may not be available
    }

    broadcastUpdate('workflow.state', { workflowId, state: finalState, progress });
    this.dags.delete(workflowId);
    this.contexts.delete(workflowId);

    if (this.dags.size === 0) {
      this.stop();
    }
  }

  private async createApproval(workflowId: string, task: TaskNode) {
    const id = nanoid(12);
    try {
      await sql`
        INSERT INTO approvals (id, title, workflow_id, agent_id, risk_score, blast_radius, reversible, severity, status)
        VALUES (${id}, ${`Approval: ${task.name}`}, ${workflowId}, ${task.agent}, ${50}, 'MEDIUM', ${true}, 'MEDIUM', 'PENDING')
      `;
    } catch {
      // DB may not be available
    }
    broadcastUpdate('approval.created', { id, workflowId, taskId: task.id, title: task.name });
  }

  async resolveApproval(workflowId: string, taskId: string, approved: boolean) {
    const dag = this.dags.get(workflowId);
    if (!dag) return;

    const node = dag.nodes.find((n) => n.id === taskId);
    if (!node || node.state !== 'BLOCKED') return;

    if (approved) {
      node.state = 'READY';
      node.approvalRequired = false;
      broadcastUpdate('task.state', { workflowId, taskId, state: 'READY', reason: 'approval_granted' });
    } else {
      node.state = 'SKIPPED';
      broadcastUpdate('task.state', { workflowId, taskId, state: 'SKIPPED', reason: 'approval_rejected' });
    }
  }

  getStatus() {
    return {
      activeWorkflows: this.dags.size,
      runningTasks: this.running.size,
      workflows: Array.from(this.dags.entries()).map(([id, dag]) => ({
        id,
        progress: planner.getProgress(dag),
        tasks: dag.nodes.length,
        running: dag.nodes.filter((n) => n.state === 'RUNNING').length,
        complete: dag.nodes.filter((n) => n.state === 'COMPLETE').length,
        failed: dag.nodes.filter((n) => n.state === 'FAILED').length,
      })),
    };
  }
}

export const scheduler = new Scheduler();
