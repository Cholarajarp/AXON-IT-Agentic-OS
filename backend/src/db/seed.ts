import { sql, closeConnection } from './connection.js';

async function seed() {
  console.log('[seed] Bootstrapping AXON IT Agentic AI OS baseline data...');

  await sql`
    INSERT INTO tenant_users (id, email, name, role, tenant_id, active)
    VALUES ('usr_owner_default', 'owner@axon.local', 'Workspace Owner', 'admin', 'tenant_default', true)
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      active = EXCLUDED.active
  `;

  await sql`
    INSERT INTO policies (id, name, type, scope, version, status, updated_at, violations_7d, rego_source) VALUES
    ('pol_prod_write_approval', 'prod-write-approval', 'Approval', 'environment:production', '1.0.0', 'ACTIVE', ${Date.now()}, 0, 'package axon.approvals'),
    ('pol_tool_sandbox', 'tool-sandbox-enforcement', 'Tool', 'agent:*', '1.0.0', 'ACTIVE', ${Date.now()}, 0, 'package axon.tools'),
    ('pol_model_budget', 'model-budget-ceiling', 'Cost', 'model:*', '1.0.0', 'ACTIVE', ${Date.now()}, 0, 'package axon.cost'),
    ('pol_data_boundary', 'data-boundary-control', 'Data', 'data:*', '1.0.0', 'ACTIVE', ${Date.now()}, 0, 'package axon.data')
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      scope = EXCLUDED.scope,
      version = EXCLUDED.version,
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at,
      rego_source = EXCLUDED.rego_source
  `;

  await sql`
    INSERT INTO evidence (id, control_id, framework, description, status, generated_at) VALUES
    ('ev_bootstrap_rbac', 'AXON-RBAC-001', 'AXON Control Baseline', 'Owner admin account and baseline RBAC policy initialized', 'SATISFIED', ${Date.now()}),
    ('ev_bootstrap_policy', 'AXON-POL-001', 'AXON Control Baseline', 'Policy, tool sandbox, model budget, and data boundary controls initialized', 'SATISFIED', ${Date.now()})
    ON CONFLICT (id) DO UPDATE SET
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      generated_at = EXCLUDED.generated_at
  `;

  console.log('[seed] Baseline seed complete. No customer workflows, incidents, alerts, or memory records were inserted.');
  await closeConnection();
}

seed().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
