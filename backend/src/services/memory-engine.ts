import { nanoid } from 'nanoid';
import { sql } from '../db/connection.js';

export interface MemoryNode {
  id: string;
  type: 'semantic' | 'episodic' | 'procedural';
  content: string;
  embedding?: number[];
  source: string;
  confidence: number;
  tags: string[];
  relatedTo: string[];
  accessCount: number;
  lastAccessed: number;
  createdAt: number;
  tenantId: string;
  workflowId?: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryQuery {
  query: string;
  type?: 'semantic' | 'episodic' | 'procedural';
  tags?: string[];
  workflowId?: string;
  tenantId: string;
  limit?: number;
  minConfidence?: number;
}

export interface MemorySearchResult {
  node: MemoryNode;
  score: number;
  breakdown: {
    semantic: number;
    graphProximity: number;
    trust: number;
    freshness: number;
    scopeMatch: number;
    citation: number;
  };
}

class MemoryEngine {
  private nodes = new Map<string, MemoryNode>();
  private edges = new Map<string, Set<string>>();

  async store(params: {
    content: string;
    type: 'semantic' | 'episodic' | 'procedural';
    source: string;
    confidence: number;
    tags: string[];
    tenantId: string;
    workflowId?: string;
    agentId?: string;
    relatedTo?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<MemoryNode> {
    const node: MemoryNode = {
      id: nanoid(12),
      type: params.type,
      content: params.content,
      source: params.source,
      confidence: params.confidence,
      tags: params.tags,
      relatedTo: params.relatedTo || [],
      accessCount: 0,
      lastAccessed: Date.now(),
      createdAt: Date.now(),
      tenantId: params.tenantId,
      workflowId: params.workflowId,
      agentId: params.agentId,
      metadata: params.metadata,
    };

    this.nodes.set(node.id, node);

    for (const relId of node.relatedTo) {
      this.addEdge(node.id, relId);
    }

    if (!isUnitTest()) {
      try {
        await sql`
          INSERT INTO memory_records (id, type, content, source, confidence, tags, access_count, related_workflows, tenant_id)
          VALUES (${node.id}, ${node.type}, ${node.content}, ${node.source}, ${node.confidence}, ${node.tags}, ${0}, ${node.relatedTo}, ${node.tenantId})
        `;
      } catch {
        // DB may not be available
      }
    }

    return node;
  }

  async search(query: MemoryQuery): Promise<MemorySearchResult[]> {
    const candidates = Array.from(this.nodes.values()).filter((n) => {
      if (n.tenantId !== query.tenantId) return false;
      if (query.type && n.type !== query.type) return false;
      if (query.minConfidence && n.confidence < query.minConfidence) return false;
      if (query.tags && !query.tags.some((t) => n.tags.includes(t))) return false;
      return true;
    });

    const scored = candidates.map((node) => {
      const breakdown = this.computeScore(node, query);
      const score = breakdown.semantic * 0.5 +
        breakdown.graphProximity * 0.15 +
        breakdown.trust * 0.1 +
        breakdown.freshness * 0.1 +
        breakdown.scopeMatch * 0.1 +
        breakdown.citation * 0.05;
      return { node, score, breakdown };
    });

    scored.sort((a, b) => b.score - a.score);
    const limit = query.limit || 10;
    const results = scored.slice(0, limit);

    for (const result of results) {
      result.node.accessCount++;
      result.node.lastAccessed = Date.now();
    }

    return results;
  }

  private computeScore(node: MemoryNode, query: MemoryQuery) {
    const semantic = this.computeSemanticSimilarity(node.content, query.query);
    const graphProximity = this.computeGraphProximity(node.id, query.workflowId);
    const trust = node.confidence;
    const freshness = this.computeFreshness(node.createdAt);
    const scopeMatch = query.workflowId && node.workflowId === query.workflowId ? 1.0 : 0.3;
    const citation = Math.min(node.accessCount / 50, 1.0);

    return { semantic, graphProximity, trust, freshness, scopeMatch, citation };
  }

  private computeSemanticSimilarity(content: string, query: string): number {
    const contentWords = new Set(content.toLowerCase().split(/\s+/));
    const queryWords = query.toLowerCase().split(/\s+/);
    const matches = queryWords.filter((w) => contentWords.has(w)).length;
    return Math.min(matches / Math.max(queryWords.length, 1), 1.0);
  }

  private computeGraphProximity(nodeId: string, targetId?: string): number {
    if (!targetId) return 0.5;
    const edges = this.edges.get(nodeId);
    if (!edges) return 0.1;
    if (edges.has(targetId)) return 1.0;
    for (const neighbor of edges) {
      const neighborEdges = this.edges.get(neighbor);
      if (neighborEdges?.has(targetId)) return 0.7;
    }
    return 0.2;
  }

  private computeFreshness(createdAt: number): number {
    const age = Date.now() - createdAt;
    const dayMs = 86400000;
    if (age < dayMs) return 1.0;
    if (age < 7 * dayMs) return 0.8;
    if (age < 30 * dayMs) return 0.5;
    return 0.2;
  }

  private addEdge(from: string, to: string) {
    if (!this.edges.has(from)) this.edges.set(from, new Set());
    if (!this.edges.has(to)) this.edges.set(to, new Set());
    this.edges.get(from)!.add(to);
    this.edges.get(to)!.add(from);
  }

  getNode(id: string): MemoryNode | undefined {
    return this.nodes.get(id);
  }

  getGraph(): { nodes: number; edges: number; types: Record<string, number> } {
    const types: Record<string, number> = {};
    for (const node of this.nodes.values()) {
      types[node.type] = (types[node.type] || 0) + 1;
    }
    let edgeCount = 0;
    for (const edges of this.edges.values()) edgeCount += edges.size;
    return { nodes: this.nodes.size, edges: edgeCount / 2, types };
  }

  async loadFromDB(tenantId: string) {
    try {
      const rows = await sql`SELECT * FROM memory_records WHERE tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT 500`;
      for (const row of rows) {
        const node: MemoryNode = {
          id: row.id as string,
          type: row.type as MemoryNode['type'],
          content: row.content as string,
          source: row.source as string,
          confidence: Number(row.confidence),
          tags: (row.tags as string[]) || [],
          relatedTo: (row.related_workflows as string[]) || [],
          accessCount: Number(row.access_count),
          lastAccessed: Number(row.last_accessed) || Date.now(),
          createdAt: Number(row.created_at) || Date.now(),
          tenantId: row.tenant_id as string,
        };
        this.nodes.set(node.id, node);
      }
    } catch {
      // DB not available
    }
  }
}

export const memoryEngine = new MemoryEngine();

function isUnitTest(): boolean {
  return process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
}
