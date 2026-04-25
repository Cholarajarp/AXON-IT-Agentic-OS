import { useMemo, useState, type ReactNode } from 'react';
import {
  CheckCircle2,
  Code2,
  ExternalLink,
  Eye,
  Loader2,
  Monitor,
  Play,
  Rocket,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Kpi,
  PageHeader,
  SeverityBadge,
} from '../components/ui/primitives';
import {
  useApproveProductBlueprint,
  useCreateProductBlueprint,
  useLaunchProductBlueprint,
  type ServiceBlueprint,
} from '../lib/queries';
import { useRouting } from '../lib/useRouting';

type PreviewMode = 'desktop' | 'mobile';

export function BuildStudio() {
  const [prompt, setPrompt] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [integrations, setIntegrations] = useState('');
  const [compliance, setCompliance] = useState('');
  const [blueprint, setBlueprint] = useState<ServiceBlueprint | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop');
  const createBlueprint = useCreateProductBlueprint();
  const approveBlueprint = useApproveProductBlueprint();
  const launchBlueprint = useLaunchProductBlueprint();
  const { setRoute } = useRouting();

  const previewHtml = useMemo(() => (blueprint || prompt.trim() ? buildPreviewHtml(blueprint, prompt) : ''), [blueprint, prompt]);
  const backlogCount = blueprint?.backlog.length ?? 0;
  const acceptanceCount = blueprint?.acceptanceCriteria.length ?? 0;
  const evidenceCount = blueprint?.evidenceRequirements.length ?? 0;
  const estimate = blueprint?.estimates.cost.totalUsd ?? 0;

  const build = async () => {
    const generated = await createBlueprint.mutateAsync({
      goal: prompt,
      customerName,
      integrations: parseList(integrations),
      compliance: parseList(compliance),
    });
    setBlueprint(generated);
  };

  const approve = async () => {
    if (!blueprint) return;
    setBlueprint(await approveBlueprint.mutateAsync(blueprint.id));
  };

  const launch = async () => {
    if (!blueprint) return;
    const launched = await launchBlueprint.mutateAsync({ id: blueprint.id });
    setBlueprint(launched.blueprint);
    setRoute('workflows');
  };

  const openPreview = () => {
    const blob = new Blob([previewHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Build Studio"
        description="Describe the product, review the plan, and preview the generated app"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Code2 size={13} />} onClick={() => setRoute('code')}>
              Code
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={createBlueprint.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              onClick={build}
              disabled={createBlueprint.isPending || prompt.trim().length < 8}
            >
              {createBlueprint.isPending ? 'Building' : 'Build'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-4">
        <Card className="overflow-hidden">
          <CardHeader
            title="Product request"
            subtitle={blueprint ? blueprint.templateName : 'New build'}
            action={blueprint ? <SeverityBadge level={blueprint.approvalRequired ? 'MEDIUM' : 'LOW'} /> : undefined}
          />
          <div className="p-4 space-y-4">
            <label className="block">
              <span className="label-mono mb-1.5 block">What should AXON build?</span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={7}
                placeholder="Describe the product, users, workflows, integrations, quality gates, and release target."
                className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
              />
            </label>

            <div className="grid grid-cols-1 gap-3">
              <Field label="Customer" value={customerName} onChange={setCustomerName} placeholder="Customer or product owner" />
              <Field label="Integrations" value={integrations} onChange={setIntegrations} placeholder="GitHub, Slack, Stripe, PostgreSQL" />
              <Field label="Compliance" value={compliance} onChange={setCompliance} placeholder="SOC 2, HIPAA, PCI DSS" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="primary"
                icon={createBlueprint.isPending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                onClick={build}
                disabled={createBlueprint.isPending || prompt.trim().length < 8}
                className="justify-center"
              >
                Generate
              </Button>
              <Button
                variant="secondary"
                icon={<Eye size={13} />}
                onClick={openPreview}
                disabled={!previewHtml}
                className="justify-center"
              >
                Open
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                label={blueprint?.status === 'draft' ? 'Approve plan' : 'Approved'}
                icon={approveBlueprint.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                disabled={!blueprint || blueprint.status !== 'draft' || approveBlueprint.isPending}
                onClick={approve}
              />
              <ActionButton
                label={blueprint?.status === 'executing' ? 'Launched' : 'Launch work'}
                icon={launchBlueprint.isPending ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
                disabled={!blueprint || blueprint.status === 'draft' || blueprint.status === 'executing' || launchBlueprint.isPending}
                onClick={launch}
              />
            </div>

            {blueprint && (
              <div className="rounded-md border border-s-border bg-s-base p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-s-primary">{blueprint.templateName}</div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-s-muted">{blueprint.status}</div>
                  </div>
                  <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[10px] font-mono text-s-secondary">
                    {blueprint.category}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {blueprint.scope.slice(0, 4).map((item) => (
                    <div key={item} className="flex items-start gap-2 text-[12px] text-s-secondary">
                      <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-s-success" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-4 min-w-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Backlog" value={String(backlogCount)} hint="Build tasks" />
            <Kpi label="Acceptance" value={String(acceptanceCount)} hint="Done criteria" />
            <Kpi label="Evidence" value={String(evidenceCount)} hint="Release proof" />
            <Kpi label="Estimate" value={estimate ? `$${estimate.toLocaleString('en-US')}` : '--'} hint="Service cost" />
          </div>

          <Card className="overflow-hidden">
            <CardHeader
              title="Live product preview"
              subtitle={blueprint ? blueprint.templateName : 'Draft preview from prompt'}
              action={
                <div className="flex items-center gap-1">
                  <IconButton active={previewMode === 'desktop'} label="Desktop preview" onClick={() => setPreviewMode('desktop')}>
                    <Monitor size={14} />
                  </IconButton>
                  <IconButton active={previewMode === 'mobile'} label="Mobile preview" onClick={() => setPreviewMode('mobile')}>
                    <Smartphone size={14} />
                  </IconButton>
                  <IconButton active={false} label="Open preview" onClick={openPreview}>
                    <ExternalLink size={14} />
                  </IconButton>
                </div>
              }
            />
            <div className="bg-s-base p-4">
              <div className={`mx-auto overflow-hidden rounded-lg border border-s-border bg-white shadow-sm ${previewMode === 'mobile' ? 'max-w-[390px]' : 'max-w-full'}`}>
                <iframe
                  title="Generated product preview"
                  srcDoc={previewHtml}
                  className={`block w-full bg-white ${previewMode === 'mobile' ? 'h-[720px]' : 'h-[680px]'}`}
                  sandbox="allow-scripts"
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="Build plan" subtitle={blueprint ? `${blueprint.backlog.length} tasks ready` : 'Generate a plan to fill this board'} />
        {!blueprint ? (
          <EmptyState icon={<Sparkles size={18} />} title="No build plan yet" description="Generate once to see tasks, owners, and acceptance criteria." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
            {blueprint.backlog.map((item) => (
              <div key={item.id} className="rounded-md border border-s-border bg-s-base p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 font-mono text-[10px] text-s-muted">{item.id}</span>
                  <span className="rounded border border-s-brand/30 bg-s-brand/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-s-brand">{item.priority}</span>
                </div>
                <div className="text-[13px] font-medium text-s-primary">{item.title}</div>
                <div className="mt-1 font-mono text-[10px] text-s-muted">{item.ownerAgent}</div>
                <div className="mt-3 space-y-1.5">
                  {item.acceptanceCriteria.slice(0, 2).map((criterion) => (
                    <div key={criterion} className="flex items-start gap-2 text-[11.5px] leading-relaxed text-s-secondary">
                      <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-s-success" />
                      <span>{criterion}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 block">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
      />
    </label>
  );
}

function ActionButton({ label, icon, disabled, onClick }: { label: string; icon: ReactNode; disabled: boolean; onClick: () => void }) {
  return (
    <Button variant="secondary" icon={icon} disabled={disabled} onClick={onClick} className="justify-center">
      {label}
    </Button>
  );
}

function IconButton({ active, label, children, onClick }: { active: boolean; label: string; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
        active ? 'border-s-brand/40 bg-s-brand/10 text-s-brand' : 'border-s-border bg-s-surface text-s-secondary hover:text-s-primary'
      }`}
    >
      {children}
    </button>
  );
}

function parseList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function buildPreviewHtml(blueprint: ServiceBlueprint | null, prompt: string) {
  const productName = blueprint?.templateName ?? inferProductName(prompt);
  const scope = blueprint?.scope ?? [
    'AI-assisted intake',
    'Admin dashboard',
    'Workflow automation',
    'Audit-ready reporting',
  ];
  const criteria = blueprint?.acceptanceCriteria ?? [
    'Users can submit and track requests',
    'Operators can review priority and status',
    'System records evidence for every action',
  ];
  const stack = blueprint?.architecture.stack ?? ['React', 'Fastify', 'PostgreSQL', 'AI router'];
  const customer = blueprint?.customerName ?? 'Customer';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(productName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f8fb; color: #151821; }
    .shell { min-height: 100vh; display: grid; grid-template-columns: 230px 1fr; }
    .side { background: #10131a; color: #eef2ff; padding: 24px 18px; }
    .brand { font-size: 18px; font-weight: 750; letter-spacing: 0; }
    .tenant { margin-top: 6px; font-size: 12px; color: #9ba7bd; }
    .nav { margin-top: 28px; display: grid; gap: 8px; }
    .nav span { padding: 10px 12px; border-radius: 8px; color: #b7c0d4; font-size: 13px; }
    .nav span:first-child { background: #243044; color: white; }
    .main { padding: 28px; }
    .top { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
    h1 { margin: 0; font-size: clamp(26px, 4vw, 42px); letter-spacing: 0; line-height: 1.05; }
    .sub { margin-top: 10px; max-width: 680px; color: #5c6577; font-size: 15px; line-height: 1.6; }
    .cta { border: 0; background: #2563eb; color: white; border-radius: 8px; padding: 12px 16px; font-weight: 700; }
    .grid { margin-top: 26px; display: grid; grid-template-columns: 1.35fr .85fr; gap: 18px; }
    .panel { background: white; border: 1px solid #e5e8ef; border-radius: 8px; overflow: hidden; }
    .panel h2 { margin: 0; padding: 18px 18px 0; font-size: 15px; }
    .cards { padding: 18px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .card { border: 1px solid #e5e8ef; border-radius: 8px; padding: 14px; background: #fbfcfe; }
    .card strong { display: block; font-size: 13px; margin-bottom: 6px; }
    .card p { margin: 0; color: #637083; font-size: 12px; line-height: 1.45; }
    .metrics { padding: 18px; display: grid; gap: 12px; }
    .metric { border: 1px solid #e5e8ef; border-radius: 8px; padding: 14px; }
    .metric div { color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    .metric strong { display: block; margin-top: 6px; font-size: 24px; }
    .table { margin: 18px; border: 1px solid #e5e8ef; border-radius: 8px; overflow: hidden; }
    .row { display: grid; grid-template-columns: 1fr auto; gap: 12px; padding: 12px 14px; border-bottom: 1px solid #edf0f5; font-size: 13px; }
    .row:last-child { border-bottom: 0; }
    .pill { background: #ecfdf5; color: #047857; border-radius: 999px; padding: 3px 8px; font-size: 11px; font-weight: 700; }
    @media (max-width: 760px) { .shell { grid-template-columns: 1fr; } .side { display: none; } .main { padding: 18px; } .grid { grid-template-columns: 1fr; } .cards { grid-template-columns: 1fr; } .top { align-items: flex-start; flex-direction: column; } }
  </style>
</head>
<body>
  <div class="shell">
    <aside class="side">
      <div class="brand">${escapeHtml(productName)}</div>
      <div class="tenant">${escapeHtml(customer)}</div>
      <div class="nav"><span>Dashboard</span><span>Requests</span><span>Automations</span><span>Reports</span><span>Settings</span></div>
    </aside>
    <main class="main">
      <div class="top">
        <div>
          <h1>${escapeHtml(productName)}</h1>
          <div class="sub">${escapeHtml(prompt)}</div>
        </div>
        <button class="cta">New request</button>
      </div>
      <section class="grid">
        <div class="panel">
          <h2>Core experience</h2>
          <div class="cards">
            ${scope.slice(0, 6).map((item, index) => `<div class="card"><strong>${index + 1}. ${escapeHtml(item)}</strong><p>Ready as a guided product module with clear ownership and release evidence.</p></div>`).join('')}
          </div>
          <div class="table">
            ${criteria.slice(0, 5).map((item) => `<div class="row"><span>${escapeHtml(item)}</span><span class="pill">ready</span></div>`).join('')}
          </div>
        </div>
        <div class="panel">
          <h2>Launch status</h2>
          <div class="metrics">
            <div class="metric"><div>Readiness</div><strong>${blueprint ? '82%' : 'Draft'}</strong></div>
            <div class="metric"><div>Stack</div><strong>${escapeHtml(stack.slice(0, 2).join(' + '))}</strong></div>
            <div class="metric"><div>Evidence</div><strong>${blueprint?.evidenceRequirements.length ?? 4}</strong></div>
          </div>
        </div>
      </section>
    </main>
  </div>
</body>
</html>`;
}

function inferProductName(prompt: string) {
  const clean = prompt.replace(/^build\s+(a|an|the)?\s*/i, '').trim();
  const words = clean.split(/\s+/).slice(0, 5).join(' ');
  return words ? titleCase(words.replace(/[.,;:]+$/g, '')) : 'Generated Product';
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
