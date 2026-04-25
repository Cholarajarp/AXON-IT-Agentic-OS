-- AXON IT Agentic AI OS - Core Schema
-- PostgreSQL 17+

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Workflows
CREATE TABLE IF NOT EXISTS workflows (
  id          TEXT PRIMARY KEY DEFAULT 'wf_' || encode(gen_random_bytes(6), 'hex'),
  name        TEXT NOT NULL,
  goal        TEXT NOT NULL,
  state       TEXT NOT NULL DEFAULT 'PENDING'
              CHECK (state IN ('RUNNING','COMPLETE','FAILED','PENDING','AWAITING_APPROVAL','BLOCKED','CANCELLED')),
  step        TEXT NOT NULL DEFAULT 'Planner agent decomposing goal',
  agent       TEXT NOT NULL DEFAULT 'IntentAgent',
  progress    INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  started_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  cost        NUMERIC(10,4) NOT NULL DEFAULT 0,
  budget      NUMERIC(10,4) NOT NULL DEFAULT 15,
  domain      TEXT[] NOT NULL DEFAULT '{}',
  model_route JSONB NOT NULL DEFAULT '{"provider":"anthropic","model":"claude-sonnet-4-5","mode":"balanced","maxCostUsd":15,"requiresApproval":true}',
  agent_flow  TEXT NOT NULL DEFAULT 'AutonomousSDLC',
  repository_url TEXT,
  tenant_id   TEXT NOT NULL DEFAULT 'tenant_default',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE workflows ADD COLUMN IF NOT EXISTS model_route JSONB NOT NULL DEFAULT '{"provider":"anthropic","model":"claude-sonnet-4-5","mode":"balanced","maxCostUsd":15,"requiresApproval":true}';
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS agent_flow TEXT NOT NULL DEFAULT 'AutonomousSDLC';
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS repository_url TEXT;

-- Agents
CREATE TABLE IF NOT EXISTS agents (
  id          TEXT PRIMARY KEY DEFAULT 'agent_' || encode(gen_random_bytes(6), 'hex'),
  type        TEXT NOT NULL,
  version     TEXT NOT NULL DEFAULT '1.0.0',
  state       TEXT NOT NULL DEFAULT 'IDLE' CHECK (state IN ('IDLE','RUNNING','ERROR')),
  current_task TEXT,
  tokens_used BIGINT NOT NULL DEFAULT 0,
  confidence  NUMERIC(4,3) NOT NULL DEFAULT 0.95,
  completion  INTEGER NOT NULL DEFAULT 0 CHECK (completion >= 0 AND completion <= 100),
  updated_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  tenant_id   TEXT NOT NULL DEFAULT 'tenant_default',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Approvals
CREATE TABLE IF NOT EXISTS approvals (
  id          TEXT PRIMARY KEY DEFAULT 'apr_' || encode(gen_random_bytes(6), 'hex'),
  title       TEXT NOT NULL,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  agent_id    TEXT NOT NULL,
  risk_score  INTEGER NOT NULL DEFAULT 50 CHECK (risk_score >= 0 AND risk_score <= 100),
  blast_radius TEXT NOT NULL DEFAULT 'LOW' CHECK (blast_radius IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  reversible  BOOLEAN NOT NULL DEFAULT true,
  expires_at  BIGINT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('HIGH','MEDIUM','LOW')),
  status      TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  tenant_id   TEXT NOT NULL DEFAULT 'tenant_default',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id          TEXT PRIMARY KEY DEFAULT 'alert_' || encode(gen_random_bytes(6), 'hex'),
  severity    TEXT NOT NULL CHECK (severity IN ('P0','P1','P2','P3')),
  title       TEXT NOT NULL,
  source      TEXT NOT NULL,
  created_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  tenant_id   TEXT NOT NULL DEFAULT 'tenant_default'
);

-- Incidents
CREATE TABLE IF NOT EXISTS incidents (
  id          TEXT PRIMARY KEY DEFAULT 'inc_' || encode(gen_random_bytes(6), 'hex'),
  severity    TEXT NOT NULL CHECK (severity IN ('P0','P1','P2','P3')),
  title       TEXT NOT NULL,
  affected    TEXT[] NOT NULL DEFAULT '{}',
  state       TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (state IN ('ACTIVE','REMEDIATING','RESOLVED','POST_MORTEM')),
  started_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  resolved_at BIGINT,
  tenant_id   TEXT NOT NULL DEFAULT 'tenant_default',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Policies
CREATE TABLE IF NOT EXISTS policies (
  id          TEXT PRIMARY KEY DEFAULT 'pol_' || encode(gen_random_bytes(6), 'hex'),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('Tool','Data','Approval','Model','Cost','Environment')),
  scope       TEXT NOT NULL DEFAULT '*',
  version     TEXT NOT NULL DEFAULT '1.0',
  status      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DRAFT','DEPRECATED')),
  updated_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  violations_7d INTEGER NOT NULL DEFAULT 0,
  rego_source TEXT,
  tenant_id   TEXT NOT NULL DEFAULT 'tenant_default',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Evidence
CREATE TABLE IF NOT EXISTS evidence (
  id          TEXT PRIMARY KEY DEFAULT 'ev_' || encode(gen_random_bytes(6), 'hex'),
  control_id  TEXT NOT NULL,
  framework   TEXT NOT NULL,
  description TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'MISSING' CHECK (status IN ('SATISFIED','PARTIAL','MISSING')),
  workflow_id TEXT,
  agent_id    TEXT,
  generated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  tenant_id   TEXT NOT NULL DEFAULT 'tenant_default',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Memory
CREATE TABLE IF NOT EXISTS memory_records (
  id          TEXT PRIMARY KEY DEFAULT 'mem_' || encode(gen_random_bytes(6), 'hex'),
  type        TEXT NOT NULL CHECK (type IN ('semantic','episodic','procedural')),
  content     TEXT NOT NULL,
  source      TEXT NOT NULL,
  confidence  NUMERIC(4,3) NOT NULL DEFAULT 0.90,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  related_workflows TEXT[] NOT NULL DEFAULT '{}',
  tenant_id   TEXT NOT NULL DEFAULT 'tenant_default',
  created_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- Cost Ledger
CREATE TABLE IF NOT EXISTS cost_ledger (
  id          TEXT PRIMARY KEY DEFAULT 'cost_' || encode(gen_random_bytes(6), 'hex'),
  workflow_id TEXT REFERENCES workflows(id) ON DELETE SET NULL,
  agent_id    TEXT,
  model       TEXT NOT NULL,
  provider    TEXT NOT NULL,
  tokens_in   INTEGER NOT NULL DEFAULT 0,
  tokens_out  INTEGER NOT NULL DEFAULT 0,
  cost        NUMERIC(10,6) NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  domain      TEXT,
  tenant_id   TEXT NOT NULL DEFAULT 'tenant_default',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflows_state ON workflows(state);
CREATE INDEX IF NOT EXISTS idx_workflows_tenant ON workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agents_state ON agents(state);
CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_incidents_state ON incidents(state);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_policies_status ON policies(status);
CREATE INDEX IF NOT EXISTS idx_evidence_framework ON evidence(framework);
CREATE INDEX IF NOT EXISTS idx_evidence_status ON evidence(status);
CREATE INDEX IF NOT EXISTS idx_cost_ledger_provider ON cost_ledger(provider);
CREATE INDEX IF NOT EXISTS idx_cost_ledger_created ON cost_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_records(type);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged);

-- Audit Chain (cryptographic integrity)
CREATE TABLE IF NOT EXISTS audit_chain (
  id            TEXT PRIMARY KEY,
  sequence      BIGINT NOT NULL,
  timestamp_ms  BIGINT NOT NULL,
  action        TEXT NOT NULL,
  actor         TEXT NOT NULL,
  actor_type    TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
  resource      TEXT NOT NULL,
  tenant_id     TEXT NOT NULL DEFAULT 'tenant_default',
  details       JSONB NOT NULL DEFAULT '{}',
  risk_level    TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  previous_hash TEXT NOT NULL,
  hash          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_chain_tenant ON audit_chain(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_chain_action ON audit_chain(action);
CREATE INDEX IF NOT EXISTS idx_audit_chain_sequence ON audit_chain(sequence);
CREATE INDEX IF NOT EXISTS idx_audit_chain_risk ON audit_chain(risk_level);

-- Tool Executions Log
CREATE TABLE IF NOT EXISTS tool_executions (
  id          TEXT PRIMARY KEY DEFAULT 'te_' || encode(gen_random_bytes(6), 'hex'),
  tool_name   TEXT NOT NULL,
  workflow_id TEXT,
  task_id     TEXT,
  agent_id    TEXT,
  tenant_id   TEXT NOT NULL DEFAULT 'tenant_default',
  parameters  JSONB NOT NULL DEFAULT '{}',
  result      JSONB,
  success     BOOLEAN NOT NULL DEFAULT false,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_exec_tenant ON tool_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tool_exec_tool ON tool_executions(tool_name);

-- RBAC Users
CREATE TABLE IF NOT EXISTS tenant_users (
  id        TEXT PRIMARY KEY,
  email     TEXT NOT NULL,
  name      TEXT NOT NULL,
  role      TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer', 'auditor', 'agent')),
  tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
  active    BOOLEAN NOT NULL DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_users_email ON tenant_users(email, tenant_id);

-- Integration Configs
CREATE TABLE IF NOT EXISTS integration_configs (
  id          TEXT PRIMARY KEY DEFAULT 'int_' || encode(gen_random_bytes(6), 'hex'),
  type        TEXT NOT NULL,
  name        TEXT NOT NULL,
  base_url    TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}',
  enabled     BOOLEAN NOT NULL DEFAULT false,
  tenant_id   TEXT NOT NULL DEFAULT 'tenant_default',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_configs_tenant ON integration_configs(tenant_id);

-- Trust Ledger persistent evidence
CREATE TABLE IF NOT EXISTS trust_ledger_records (
  id            TEXT PRIMARY KEY,
  sequence      BIGINT NOT NULL,
  tenant_id     TEXT NOT NULL DEFAULT 'tenant_default',
  kind          TEXT NOT NULL,
  actor         TEXT NOT NULL,
  actor_type    TEXT NOT NULL,
  subject       TEXT NOT NULL,
  summary       TEXT NOT NULL,
  risk          TEXT NOT NULL,
  source        TEXT NOT NULL,
  artifacts     JSONB NOT NULL DEFAULT '[]',
  metadata      JSONB NOT NULL DEFAULT '{}',
  controls      JSONB NOT NULL DEFAULT '[]',
  timestamp     TIMESTAMPTZ NOT NULL,
  previous_hash TEXT NOT NULL,
  hash          TEXT NOT NULL,
  signature     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trust_ledger_tenant ON trust_ledger_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trust_ledger_kind ON trust_ledger_records(kind);
CREATE INDEX IF NOT EXISTS idx_trust_ledger_sequence ON trust_ledger_records(sequence);

-- Artifact manifest for release packs, traces, screenshots, reports, packages
CREATE TABLE IF NOT EXISTS artifact_objects (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL DEFAULT 'tenant_default',
  kind         TEXT NOT NULL,
  name         TEXT NOT NULL,
  uri          TEXT NOT NULL,
  sha256       TEXT NOT NULL,
  bytes        BIGINT NOT NULL,
  content_type TEXT NOT NULL,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_tenant ON artifact_objects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_kind ON artifact_objects(kind);
CREATE INDEX IF NOT EXISTS idx_artifacts_sha ON artifact_objects(sha256);
