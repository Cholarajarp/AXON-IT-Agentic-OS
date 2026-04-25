import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';

export interface SkillPack {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  owner: string;
  capabilities: string[];
  prompts: string[];
  allowedTools: string[];
  riskLevel: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
}

export interface SkillPackInput {
  name: string;
  description: string;
  enabled?: boolean;
  owner?: string;
  capabilities?: string[];
  prompts?: string[];
  allowedTools?: string[];
  riskLevel?: SkillPack['riskLevel'];
}

const DEFAULT_SKILLS: SkillPack[] = [
  {
    id: 'skill_repo_repair',
    name: 'Repository Repair',
    description: 'Diagnose broken installs, failing tests, dependency drift, and unsafe refactors.',
    enabled: true,
    owner: 'platform',
    capabilities: ['code-search', 'diff-review', 'test-execution', 'dependency-audit'],
    prompts: ['Find the smallest safe fix before broad refactors.', 'Preserve user changes and explain residual risk.'],
    allowedTools: ['code.search', 'git.diff', 'shell.test', 'dependency.audit'],
    riskLevel: 'medium',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'skill_product_factory',
    name: 'Product Factory Delivery',
    description: 'Convert business goals into scope, price, backlog, architecture, evidence, and execution.',
    enabled: true,
    owner: 'platform',
    capabilities: ['intake-classification', 'blueprint-generation', 'cost-estimation', 'traceability'],
    prompts: ['Every generated task must trace to an acceptance criterion.', 'Separate customer brief from engineering plan.'],
    allowedTools: ['product-factory.blueprint', 'orchestrator.execute', 'evidence.write'],
    riskLevel: 'medium',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

class SkillRegistry {
  private readonly stateDir = path.resolve(process.env.AXON_LOCAL_STATE_DIR || path.join(process.cwd(), '.axon'));
  private readonly filePath = path.join(this.stateDir, 'skill-packs.json');

  async list(): Promise<SkillPack[]> {
    const custom = await this.readCustom();
    const customIds = new Set(custom.map((skill) => skill.id));
    return [...DEFAULT_SKILLS.filter((skill) => !customIds.has(skill.id)), ...custom];
  }

  async upsert(input: SkillPackInput & { id?: string }): Promise<SkillPack> {
    const existing = await this.readCustom();
    const previous = existing.find((skill) => skill.id === input.id);
    const now = new Date().toISOString();
    const next: SkillPack = {
      id: input.id || previous?.id || `skill_${nanoid(8)}`,
      name: input.name,
      description: input.description,
      enabled: input.enabled ?? previous?.enabled ?? true,
      owner: input.owner || previous?.owner || 'operator',
      capabilities: input.capabilities ?? previous?.capabilities ?? [],
      prompts: input.prompts ?? previous?.prompts ?? [],
      allowedTools: input.allowedTools ?? previous?.allowedTools ?? [],
      riskLevel: input.riskLevel ?? previous?.riskLevel ?? 'medium',
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };

    await this.writeCustom([...existing.filter((skill) => skill.id !== next.id), next]);
    return next;
  }

  async setEnabled(id: string, enabled: boolean): Promise<SkillPack | undefined> {
    const skill = (await this.list()).find((item) => item.id === id);
    if (!skill) return undefined;
    return this.upsert({ ...skill, enabled });
  }

  async remove(id: string): Promise<boolean> {
    const custom = await this.readCustom();
    const next = custom.filter((skill) => skill.id !== id);
    await this.writeCustom(next);
    return next.length !== custom.length;
  }

  private async readCustom(): Promise<SkillPack[]> {
    try {
      return JSON.parse(await readFile(this.filePath, 'utf8')) as SkillPack[];
    } catch {
      return [];
    }
  }

  private async writeCustom(skills: SkillPack[]): Promise<void> {
    await mkdir(this.stateDir, { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(skills, null, 2)}\n`, 'utf8');
  }
}

export const skillRegistry = new SkillRegistry();
