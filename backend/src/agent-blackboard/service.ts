import { nanoid } from 'nanoid';
import type {
  AgentBlackboard,
  BlackboardEntry,
  BlackboardEntryInput,
  BlackboardInput,
  FileOwnershipInput,
} from './types.js';

const boards = new Map<string, AgentBlackboard>();

export class AgentBlackboardService {
  listBoards(): AgentBlackboard[] {
    return Array.from(boards.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  getBoard(id: string): AgentBlackboard | undefined {
    return boards.get(id);
  }

  createBoard(input: BlackboardInput): AgentBlackboard {
    const now = new Date().toISOString();
    const board: AgentBlackboard = {
      id: `bb_${nanoid(10)}`,
      tenantId: input.tenantId ?? 'tenant_default',
      missionId: input.missionId ?? `mission_${nanoid(8)}`,
      title: input.title.trim(),
      goal: input.goal.trim(),
      ownerAgent: input.ownerAgent ?? 'DeliveryManagerAgent',
      status: 'active',
      entries: [],
      fileOwnership: [],
      decisionSummary: 'No decisions recorded yet.',
      riskSummary: 'No open risks recorded yet.',
      openBlockers: 0,
      nextActions: ['Create plan', 'Assign file ownership', 'Attach evidence'],
      evidence: ['blackboard created'],
      createdAt: now,
      updatedAt: now,
    };
    boards.set(board.id, board);
    return board;
  }

  addEntry(boardId: string, input: BlackboardEntryInput): BlackboardEntry | undefined {
    const board = boards.get(boardId);
    if (!board) return undefined;
    const now = new Date().toISOString();
    const entry: BlackboardEntry = {
      id: `bbe_${nanoid(10)}`,
      kind: input.kind,
      title: input.title.trim(),
      detail: input.detail.trim(),
      agent: input.agent,
      severity: input.severity ?? (input.kind === 'blocker' || input.kind === 'risk' ? 'high' : 'medium'),
      status: input.status ?? 'open',
      evidence: input.evidence ?? [],
      relatedFiles: input.relatedFiles ?? [],
      createdAt: now,
      updatedAt: now,
    };
    board.entries.unshift(entry);
    updateSummaries(board);
    return entry;
  }

  updateEntryStatus(boardId: string, entryId: string, status: BlackboardEntry['status']): BlackboardEntry | undefined {
    const board = boards.get(boardId);
    if (!board) return undefined;
    const entry = board.entries.find((item) => item.id === entryId);
    if (!entry) return undefined;
    entry.status = status;
    entry.updatedAt = new Date().toISOString();
    updateSummaries(board);
    return entry;
  }

  claimFile(boardId: string, input: FileOwnershipInput): AgentBlackboard | undefined {
    const board = boards.get(boardId);
    if (!board) return undefined;
    const existing = board.fileOwnership.find((claim) => claim.filePath === input.filePath);
    if (existing) {
      existing.agent = input.agent;
      existing.reason = input.reason;
      existing.claimedAt = new Date().toISOString();
    } else {
      board.fileOwnership.unshift({
        filePath: input.filePath,
        agent: input.agent,
        reason: input.reason,
        claimedAt: new Date().toISOString(),
      });
    }
    board.evidence.unshift(`file ownership ${input.filePath} by ${input.agent}`);
    updateSummaries(board);
    return board;
  }

  seedMissionBoard(input: {
    missionId: string;
    title: string;
    goal: string;
    agents: string[];
    evidence: string[];
    risks: string[];
  }): AgentBlackboard {
    const board = this.createBoard({
      missionId: input.missionId,
      title: input.title,
      goal: input.goal,
      ownerAgent: 'PMOAgent',
    });

    this.addEntry(board.id, {
      kind: 'decision',
      title: 'Mission accepted with no-repeat-question policy',
      detail: 'AXON should infer reasonable defaults, ask only blocker questions, and proceed through evidence-gated work.',
      agent: 'DeliveryManagerAgent',
      severity: 'medium',
      evidence: ['mission intake'],
    });

    for (const agent of input.agents.slice(0, 8)) {
      this.addEntry(board.id, {
        kind: 'ownership',
        title: `${agent} assigned`,
        detail: `${agent} owns a slice of planning, implementation, verification, or release evidence.`,
        agent,
        severity: 'low',
      });
    }

    for (const risk of input.risks.slice(0, 6)) {
      this.addEntry(board.id, {
        kind: 'risk',
        title: risk,
        detail: 'Risk imported from mission or release evidence and must be resolved before production exposure.',
        agent: 'RiskAgent',
        severity: 'high',
      });
    }

    board.evidence.unshift(...input.evidence);
    updateSummaries(board);
    return board;
  }
}

function updateSummaries(board: AgentBlackboard) {
  const openEntries = board.entries.filter((entry) => entry.status === 'open');
  const decisions = board.entries.filter((entry) => entry.kind === 'decision' && entry.status !== 'superseded');
  const risks = openEntries.filter((entry) => entry.kind === 'risk' || entry.kind === 'blocker');
  const nextActions = openEntries.filter((entry) => entry.kind === 'next-action' || entry.kind === 'blocker' || entry.kind === 'risk');

  board.openBlockers = openEntries.filter((entry) => entry.kind === 'blocker' || entry.severity === 'critical').length;
  board.status = board.openBlockers > 0 ? 'blocked' : openEntries.length === 0 && board.entries.length > 0 ? 'resolved' : 'active';
  board.decisionSummary = decisions.length
    ? decisions.slice(0, 4).map((entry) => entry.title).join(' | ')
    : 'No decisions recorded yet.';
  board.riskSummary = risks.length
    ? risks.slice(0, 4).map((entry) => `${entry.severity}: ${entry.title}`).join(' | ')
    : 'No open risks recorded yet.';
  board.nextActions = nextActions.length
    ? nextActions.slice(0, 6).map((entry) => entry.title)
    : ['Continue execution', 'Attach validation evidence', 'Prepare release gate'];
  board.updatedAt = new Date().toISOString();
}

export const agentBlackboard = new AgentBlackboardService();
