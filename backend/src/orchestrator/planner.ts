import { nanoid } from 'nanoid';
import { AGENT_CAPABILITIES, GOAL_TEMPLATES, classifyGoalType } from './planner-catalog.js';
import type { TaskDAG, TaskNode } from './types.js';

export interface GoalSpec {
  workflowId: string;
  goal: string;
  domain: string[];
  constraints?: {
    budget?: number;
    deadline?: number;
    approvalPolicy?: 'always' | 'high-risk' | 'never';
    sovereignMode?: boolean;
  };
}

export class DAGPlanner {
  classifyGoal(goal: string): string {
    return classifyGoalType(goal);
  }

  plan(spec: GoalSpec): TaskDAG {
    const goalType = this.classifyGoal(spec.goal);
    const template = GOAL_TEMPLATES[goalType];
    const output = template(spec.goal);

    const nodes: TaskNode[] = output.tasks.map((t, idx) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      agent: t.agent,
      dependsOn: idx === 0 ? [] : [output.tasks[idx - 1].id],
      state: idx === 0 ? 'READY' : 'PENDING',
      input: t.input,
      retries: 0,
      maxRetries: 2,
      timeoutMs: t.timeoutMs,
      approvalRequired: spec.constraints?.approvalPolicy === 'always'
        ? true
        : spec.constraints?.approvalPolicy === 'never'
          ? false
          : t.approvalRequired,
    }));

    return {
      id: nanoid(12),
      workflowId: spec.workflowId,
      goal: spec.goal,
      nodes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  getReadyTasks(dag: TaskDAG): TaskNode[] {
    return dag.nodes.filter((node) => {
      if (node.state !== 'PENDING') return false;
      return node.dependsOn.every((depId) => {
        const dep = dag.nodes.find((n) => n.id === depId);
        return dep?.state === 'COMPLETE';
      });
    });
  }

  advanceDAG(dag: TaskDAG): TaskDAG {
    const updated = { ...dag, nodes: [...dag.nodes], updatedAt: Date.now() };
    for (const node of updated.nodes) {
      if (node.state !== 'PENDING') continue;
      const depsComplete = node.dependsOn.every((depId) => {
        const dep = updated.nodes.find((n) => n.id === depId);
        return dep?.state === 'COMPLETE';
      });
      const depsFailed = node.dependsOn.some((depId) => {
        const dep = updated.nodes.find((n) => n.id === depId);
        return dep?.state === 'FAILED' || dep?.state === 'SKIPPED';
      });
      if (depsFailed) {
        node.state = 'BLOCKED';
      } else if (depsComplete) {
        node.state = 'READY';
      }
    }
    return updated;
  }

  isComplete(dag: TaskDAG): boolean {
    return dag.nodes.every((n) => n.state === 'COMPLETE' || n.state === 'SKIPPED' || n.state === 'FAILED' || n.state === 'BLOCKED');
  }

  getProgress(dag: TaskDAG): number {
    const total = dag.nodes.length;
    if (total === 0) return 100;
    const done = dag.nodes.filter((n) => n.state === 'COMPLETE' || n.state === 'SKIPPED').length;
    return Math.round((done / total) * 100);
  }

  getAgentCapabilities(): typeof AGENT_CAPABILITIES {
    return AGENT_CAPABILITIES;
  }
}

export const planner = new DAGPlanner();
