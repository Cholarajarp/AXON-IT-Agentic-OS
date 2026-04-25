import { useState, type ReactNode } from 'react';
import {
  Bot,
  CheckCircle2,
  Code2,
  FileCode2,
  KeyRound,
  Loader2,
  PackageCheck,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
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
  useApiForgeReports,
  useCreateApiForgeReport,
  type ApiForgeReport,
  type ApiForgeTarget,
  type ApiOperation,
} from '../lib/queries';
import { useRouting } from '../lib/useRouting';

export function ApiForge() {
  const reports = useApiForgeReports();
  const createReport = useCreateApiForgeReport();
  const { setRoute } = useRouting();
  const [name, setName] = useState('');
  const [packageName, setPackageName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [specText, setSpecText] = useState('');
  const [selected, setSelected] = useState<ApiForgeReport | null>(null);

  const current = selected ?? reports.data?.reports[0] ?? null;
  const gatePass = current?.qualityGates.filter((gate) => gate.passed).length ?? 0;
  const mcpTools = current?.mcpPlan.tools.length ?? 0;
  const artifacts = current?.generatedArtifacts.length ?? 0;
  const canCreate = specText.trim().length > 0 && !createReport.isPending;

  const create = async () => {
    const report = await createReport.mutateAsync({
      name,
      packageName,
      baseUrl,
      specText,
      targets: ['typescript', 'python', 'go', 'java', 'cli', 'mcp-server', 'docs-search'] satisfies ApiForgeTarget[],
      authType: 'bearer',
      agentOptimized: true,
    });
    setSelected(report);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="API Forge"
        description="OpenAPI to native SDKs, CLI, MCP server, docs-search, safety gates, and agent-ready connectors"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Bot size={13} />} onClick={() => setRoute('integrations')}>
              Integrations
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={createReport.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              onClick={create}
              disabled={!canCreate}
            >
              {createReport.isPending ? 'Forging' : 'Forge API'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Contract Score" value={current ? `${current.contractScore}%` : '0%'} hint={current?.status ?? 'No report'} />
        <Kpi label="Operations" value={String(current?.specStats.operations ?? 0)} hint="Spec endpoints" />
        <Kpi label="MCP Tools" value={String(mcpTools)} hint={current?.mcpPlan.mode ?? 'Not generated'} />
        <Kpi label="Gates" value={current ? `${gatePass}/${current.qualityGates.length}` : '0/0'} hint={`${artifacts} artifacts`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)] gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="OpenAPI intake" subtitle="Paste a real OpenAPI JSON contract to generate SDKs, CLI, MCP tools, and docs search" action={<FileCode2 size={14} className="text-s-brand" />} />
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="API name" value={name} onChange={setName} placeholder="Production API name" />
              <Field label="Package" value={packageName} onChange={setPackageName} placeholder="company-api-client" />
            </div>
            <Field label="Base URL" value={baseUrl} onChange={setBaseUrl} placeholder="https://api.company.com/v1" />
            <label className="block">
              <span className="label-mono mb-1.5 block">OpenAPI JSON</span>
              <textarea
                value={specText}
                onChange={(event) => setSpecText(event.target.value)}
                rows={18}
                placeholder='{"openapi":"3.1.0","info":{"title":"Your API","version":"1.0.0"},"paths":{}}'
                className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 font-mono text-[11px] leading-relaxed text-s-primary outline-none focus:border-s-brand"
              />
            </label>
            <Button
              variant="primary"
              icon={createReport.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              onClick={create}
              disabled={!canCreate}
              className="w-full justify-center"
            >
              {createReport.isPending ? 'Generating SDK/MCP plan' : 'Generate SDK, CLI, MCP and docs plan'}
            </Button>
          </div>
        </Card>

        <ForgeOverview report={current} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <OperationsPanel operations={current?.operations ?? []} />
        <McpPanel report={current} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SdkPanel report={current} />
        <ArtifactsPanel report={current} />
      </div>
    </div>
  );
}

function ForgeOverview({ report }: { report: ApiForgeReport | null }) {
  if (!report) {
    return (
      <Card>
        <CardHeader title="Forge output" subtitle="No API package yet" />
        <EmptyState icon={<PackageCheck size={18} />} title="Generate an API package" description="AXON will produce SDK targets, CLI commands, MCP tools, docs-search plan, and release gates." />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader title={report.name} subtitle={`${report.packageName} • ${report.baseUrl}`} action={<SeverityBadge level={report.status === 'ready' ? 'LOW' : report.status === 'blocked' ? 'CRITICAL' : 'MEDIUM'} />} />
      <div className="p-4 space-y-4">
        <div className="rounded-md border border-s-border bg-s-base p-4 text-[12px] leading-relaxed text-s-secondary">
          {report.summary}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Mini label="Paths" value={String(report.specStats.paths)} />
          <Mini label="Schemas" value={String(report.specStats.schemas)} />
          <Mini label="Destructive" value={String(report.specStats.destructiveOperations)} />
        </div>

        <div className="rounded-md border border-s-border bg-s-base p-3">
          <div className="flex items-center gap-2 text-[13px] font-medium text-s-primary">
            <KeyRound size={14} className="text-s-info" />
            Auth: {report.auth.type}
          </div>
          <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{report.auth.recommendation}</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {report.qualityGates.map((gate) => (
            <div key={gate.id} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className={gate.passed ? 'text-s-success' : 'text-s-warning'} />
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-s-primary">{gate.title}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {gate.evidence.map((item) => (
                  <span key={item} className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono text-s-muted">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function OperationsPanel({ operations }: { operations: ApiOperation[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Operation map" subtitle={`${operations.length} API operation${operations.length === 1 ? '' : 's'}`} />
      <div className="divide-y divide-s-border max-h-[520px] overflow-y-auto">
        {operations.map((operation) => (
          <div key={operation.id} className="p-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 font-mono text-[10px] text-s-primary">{operation.method}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-s-primary">{operation.path}</span>
              <SeverityBadge level={operation.risk.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'} />
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{operation.summary}</div>
            <div className="mt-2 font-mono text-[10px] text-s-muted">{operation.operationId}</div>
          </div>
        ))}
        {operations.length === 0 && <EmptyState icon={<Code2 size={18} />} title="No operations parsed" />}
      </div>
    </Card>
  );
}

function McpPanel({ report }: { report: ApiForgeReport | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="MCP and docs-search" subtitle={report?.mcpPlan.mode ?? 'Agent connector plan'} />
      {!report ? (
        <EmptyState icon={<Bot size={18} />} title="No MCP plan yet" />
      ) : (
        <div className="p-4 space-y-4">
          <div className="rounded-md border border-s-border bg-s-base p-3 text-[12px] leading-relaxed text-s-secondary">
            {report.mcpPlan.tokenEfficiency}
          </div>
          {report.mcpPlan.tools.map((tool) => (
            <div key={tool.name} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="flex items-center gap-2 min-w-0">
                <Bot size={14} className="text-s-brand" />
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-s-primary">{tool.name}</span>
                <SeverityBadge level={tool.risk.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'} />
              </div>
              <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{tool.purpose}</div>
              <div className="mt-2 font-mono text-[10px] text-s-muted">{tool.operations.length} operation(s)</div>
            </div>
          ))}
          <ListBlock title="Sandbox policy" items={report.mcpPlan.sandboxPolicy} icon={<ShieldCheck size={13} className="text-s-success" />} />
          <ListBlock title="Docs retrieval" items={report.docsSearchPlan.retrievalPolicy} icon={<Search size={13} className="text-s-info" />} />
        </div>
      )}
    </Card>
  );
}

function SdkPanel({ report }: { report: ApiForgeReport | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="SDK and CLI targets" subtitle="Native client experience" />
      <div className="divide-y divide-s-border">
        {(report?.sdkTargets ?? []).map((target) => (
          <div key={target.language} className="p-4">
            <div className="flex items-center gap-2">
              <Code2 size={14} className="text-s-brand" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium capitalize text-s-primary">{target.language}</span>
              <span className="font-mono text-[10px] text-s-muted">{target.packageName}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {target.nativePatterns.map((item) => (
                <span key={item} className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono text-s-muted">
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
        {report && (
          <div className="p-4">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-s-info" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{report.cliPlan.packageName}</span>
            </div>
            <div className="mt-2 space-y-1">
              {report.cliPlan.commands.slice(0, 5).map((command) => (
                <div key={command.command} className="rounded border border-s-border bg-s-base px-2 py-1.5 font-mono text-[10px] text-s-muted">
                  {command.command}
                </div>
              ))}
            </div>
          </div>
        )}
        {!report && <EmptyState icon={<Code2 size={18} />} title="No SDK plan yet" />}
      </div>
    </Card>
  );
}

function ArtifactsPanel({ report }: { report: ApiForgeReport | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Generated artifacts" subtitle="Preview paths and content" />
      <div className="divide-y divide-s-border max-h-[520px] overflow-y-auto">
        {(report?.generatedArtifacts ?? []).map((artifact) => (
          <div key={artifact.path} className="p-4">
            <div className="flex items-center gap-2 min-w-0">
              <PackageCheck size={14} className="text-s-success" />
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-s-primary">{artifact.path}</span>
              <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 font-mono text-[9px] uppercase text-s-muted">{artifact.kind}</span>
            </div>
            <pre className="mt-2 max-h-28 overflow-auto rounded-md border border-s-border bg-s-base p-2 text-[10px] text-s-muted">
              {artifact.contentPreview}
            </pre>
          </div>
        ))}
        {!report && <EmptyState icon={<PackageCheck size={18} />} title="No artifacts yet" />}
      </div>
    </Card>
  );
}

function ListBlock({ title, items, icon }: { title: string; items: string[]; icon: ReactNode }) {
  return (
    <div className="rounded-md border border-s-border bg-s-base p-3">
      <div className="label-mono mb-2">{title}</div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2 text-[12px] leading-relaxed text-s-secondary">
            <span className="mt-0.5 shrink-0">{icon}</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-s-border bg-s-subtle p-3">
      <div className="label-mono mb-1">{label}</div>
      <div className="font-mono text-lg text-s-primary">{value}</div>
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
