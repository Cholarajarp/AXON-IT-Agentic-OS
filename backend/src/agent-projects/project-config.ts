import type {
  AgentProject,
  AgentProjectFolder,
  AgentProjectHook,
  AgentProjectPermission,
  AgentProjectTemplate,
} from './types.js';

export function projectTemplates(): AgentProjectTemplate[] {
  return [
    {
      id: 'template_saas_delivery',
      name: 'SaaS Product Delivery Room',
      objective: 'Deliver a production-ready SaaS feature with implementation, QA, release, and customer handoff evidence.',
      prompt: '/goal build a SaaS feature through plan, implementation, tests, browser QA, release pack, and customer delivery report',
      folders: [
        { path: '.', type: 'git-checkout', writable: true, reason: 'Canonical project root.' },
        { path: 'backend', type: 'local-folder', writable: true, reason: 'API and runtime implementation.' },
        { path: 'src', type: 'local-folder', writable: true, reason: 'Web command OS implementation.' },
        { path: 'docs', type: 'local-folder', writable: true, reason: 'Operator and customer documentation.' },
      ],
      skills: ['repo-map', 'product-factory', 'browser-qa', 'release-evidence', 'customer-delivery'],
      mcpServers: ['filesystem', 'git', 'browser', 'database-readonly'],
      securityPreset: 'default',
      worktreeMode: 'new-worktree',
      reviewPolicy: 'request-review',
    },
    {
      id: 'template_database_safe_modernization',
      name: 'Database-Safe Modernization',
      objective: 'Modernize database-backed software with migration safety, rollback proof, data quality, and release gates.',
      prompt: '/goal modernize a database-backed app with schema review, migration rollback, tests, release pack, and customer evidence',
      folders: [
        { path: '.', type: 'git-checkout', writable: true, reason: 'Canonical project root.' },
        { path: 'backend/src/db', type: 'local-folder', writable: true, reason: 'Database schema, migrations, and seed logic.' },
        { path: 'backend/src/database-pipeline', type: 'local-folder', writable: true, reason: 'Database review and safety logic.' },
        { path: 'docs', type: 'local-folder', writable: true, reason: 'Database runbook and rollback documentation.' },
      ],
      skills: ['database-safety', 'migration-review', 'data-quality', 'release-evidence'],
      mcpServers: ['filesystem', 'git', 'database-readonly'],
      securityPreset: 'restricted',
      worktreeMode: 'new-worktree',
      reviewPolicy: 'request-review',
    },
    {
      id: 'template_managed_it_ops',
      name: 'Managed AI IT Operations',
      objective: 'Run recurring production readiness, incident, SLA, security, cost, and customer operations checks.',
      prompt: '/schedule run recurring managed IT operations audit with incidents, SLA, security, model cost, release blockers, and customer update',
      folders: [
        { path: 'backend', type: 'local-folder', writable: true, reason: 'Runtime services and operational agents.' },
        { path: 'docs', type: 'local-folder', writable: true, reason: 'Runbooks, reports, and compliance evidence.' },
      ],
      skills: ['managed-services', 'service-desk', 'security-center', 'model-finops', 'trust-ledger'],
      mcpServers: ['filesystem', 'git', 'database-readonly'],
      securityPreset: 'default',
      worktreeMode: 'new-worktree',
      reviewPolicy: 'request-review',
    },
  ];
}

export function normalizeFolders(input?: AgentProjectFolder[]): AgentProjectFolder[] {
  const fallback: AgentProjectFolder[] = [
    { path: '.', type: 'git-checkout', writable: true, reason: 'Canonical AXON root project.' },
    { path: 'backend', type: 'local-folder', writable: true, reason: 'Active Fastify API.' },
    { path: 'src', type: 'local-folder', writable: true, reason: 'Active React frontend.' },
  ];
  return (input?.length ? input : fallback).map((folder) => ({
    path: folder.path.trim(),
    type: folder.type,
    writable: folder.writable,
    reason: folder.reason.trim() || 'Project context folder.',
  }));
}

export function normalizePermissions(
  input: AgentProjectPermission[] | undefined,
  preset: AgentProject['securityPreset'],
): AgentProjectPermission[] {
  const base: AgentProjectPermission[] = [
    { scope: 'project-folders', grant: 'read', persistence: 'project', risk: 'low' },
    { scope: 'project-folders', grant: 'write', persistence: 'project', risk: preset === 'restricted' ? 'medium' : 'low' },
    { scope: 'terminal', grant: 'execute', persistence: 'conversation', risk: 'high' },
    { scope: 'browser', grant: 'browser', persistence: 'conversation', risk: 'medium' },
  ];
  if (preset === 'full-machine' || preset === 'unrestricted') {
    base.push({ scope: 'full-machine', grant: 'write', persistence: 'project', risk: 'critical' });
  }
  return input?.length ? input : base;
}

export function defaultHooks(): AgentProjectHook[] {
  return [
    { id: 'hook_policy_before_tool', event: 'before-tool-call', action: 'Run policy and permission check', policy: 'block destructive commands without review', enabled: true },
    { id: 'hook_artifact_review', event: 'artifact-review', action: 'Pause on plans, diffs, browser recordings, and release packs', policy: 'request-review', enabled: true },
    { id: 'hook_loop_stop', event: 'loop-stop', action: 'Require evidence summary and cost ledger entry', policy: 'trust-ledger-required', enabled: true },
    { id: 'hook_browser_capture', event: 'browser-session', action: 'Capture screenshot, network, console, and video artifacts', policy: 'browser-evidence-required', enabled: true },
  ];
}

export function scoreProject(input: {
  folders: AgentProjectFolder[];
  securityPreset: AgentProject['securityPreset'];
  worktreeMode: AgentProject['worktreeMode'];
  reviewPolicy: AgentProject['reviewPolicy'];
  hooks: AgentProjectHook[];
  permissions: AgentProjectPermission[];
}): AgentProject['readiness'] {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (input.folders.length === 0) blockers.push('At least one project folder is required.');
  if (input.permissions.some((permission) => permission.risk === 'critical') && input.reviewPolicy !== 'request-review') {
    blockers.push('Critical permissions require artifact review.');
  }
  if (input.securityPreset === 'unrestricted') warnings.push('Unrestricted mode is not safe for customer projects.');
  if (input.worktreeMode === 'local') warnings.push('Local mode can create conflicts when parallel agents edit the same checkout.');
  if (!input.hooks.some((hook) => hook.event === 'before-tool-call' && hook.enabled)) {
    blockers.push('A before-tool-call policy hook is required.');
  }
  if (!input.hooks.some((hook) => hook.event === 'artifact-review' && hook.enabled)) {
    warnings.push('Artifact review hook is disabled.');
  }
  const score = Math.max(0, 100 - blockers.length * 35 - warnings.length * 10);
  return {
    score,
    status: blockers.length ? 'blocked' : warnings.length ? 'needs-review' : 'ready',
    blockers,
    warnings,
  };
}
