import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Loader2, Play, RefreshCw, Shield, Terminal as TerminalIcon, Wrench, XCircle } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Kpi,
  PageHeader,
  SeverityBadge,
} from '../components/ui/primitives';
import { PipelineVisualizer } from '../components/pipeline-visualizer';
import {
  useExecuteTool,
  useToolPipeline,
  useToolsRegistry,
  useToolsStats,
  type ToolDefinition,
  type ToolRuntimeResult,
} from '../lib/queries';

/**
 * Tools surface.
 *
 * Exposes the hardened tool runtime:
 *   - Registered tool definitions with risk levels and approval flags.
 *   - The 13-step tool pipeline (the same one that enforces every call at runtime).
 *   - A live execute form that POSTs /tools/execute and visualizes which step
 *     the request passed or was aborted at, including policy decisions and
 *     sanitization flags.
 */

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type SensitivityLevel = 'public' | 'internal' | 'confidential' | 'restricted';

export function Tools() {
  const { data: registry, isLoading: loadingTools, isError: regError, refetch: refetchTools } = useToolsRegistry();
  const { data: pipeline } = useToolPipeline();
  const { data: stats } = useToolsStats();
  const execute = useExecuteTool();

  const tools = registry?.tools ?? [];
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [paramsJson, setParamsJson] = useState<string>('');
  const [sensitivityLevel, setSensitivityLevel] = useState<SensitivityLevel>('internal');
  const [sovereignMode, setSovereignMode] = useState<boolean>(false);
  const [approvalApproved, setApprovalApproved] = useState<boolean>(true);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const selected = tools.find((t) => t.name === selectedTool) ?? null;

  const lastResult = execute.data ?? null;

  useEffect(() => {
    const tool = tools.find((item) => item.name === selectedTool);
    if (!tool) {
      setParamsJson('');
      return;
    }
    setParamsJson(JSON.stringify(buildParameterTemplate(tool), null, 2));
  }, [selectedTool, tools]);

  const onExecute = async () => {
    setJsonError(null);
    if (!selectedTool) return;

    let parameters: Record<string, unknown>;
    try {
      parameters = JSON.parse(paramsJson);
    } catch (err) {
      setJsonError((err as Error).message);
      return;
    }

    await execute.mutateAsync({
      toolName: selectedTool,
      parameters,
      workflowId: `wf_ui_${Date.now()}`,
      taskId: `task_ui_${Date.now()}`,
      agentId: 'UIOperator',
      tenantId: 'tenant_default',
      sensitivityLevel,
      sovereignMode,
      approvalApproved,
    }).catch(() => {
      // useExecuteTool already surfaces the error; we also keep any returned ToolRuntimeResult visible.
    });
  };

  if (loadingTools) {
    return (
      <div>
        <PageHeader title="Tools" description="Policy-bound tool runtime with 13-step enforcement" />
        <Card>
          <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Loading tool registry" description="Fetching registered tools and pipeline definition." />
        </Card>
      </div>
    );
  }

  if (regError) {
    return (
      <div>
        <PageHeader title="Tools" description="Policy-bound tool runtime with 13-step enforcement" />
        <Card>
          <EmptyState
            icon={<Wrench size={18} />}
            title="Tool registry unavailable"
            description="The backend /tools/registry endpoint is unreachable."
            action={<Button variant="primary" size="sm" icon={<RefreshCw size={13} />} onClick={() => refetchTools()}>Retry</Button>}
          />
        </Card>
      </div>
    );
  }

  const totalCritical = tools.filter((t) => t.riskLevel === 'critical' || t.riskLevel === 'high').length;

  return (
    <div>
      <PageHeader
        title="Tools"
        description="Every tool call flows through the 13-step enforcement pipeline: sandbox, RBAC, rate-limit, policy, sanitization, audit."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Kpi label="Registered Tools" value={String(tools.length)} hint="All governed by the runtime spine" />
        <Kpi label="High/Critical Risk" value={String(totalCritical)} delta="approval-gated" trend="flat" hint="Refused without explicit approval" />
        <Kpi label="Lifetime Executions" value={String(stats?.totalExecutions ?? 0)} hint="In-memory counter" />
        <Kpi
          label="Success Rate"
          value={stats ? `${stats.successRate.toFixed(1)}%` : '—'}
          trend={stats && stats.successRate >= 95 ? 'up' : 'flat'}
          hint="Across all tools since boot"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4 mb-5">
        <ToolsTable tools={tools} selected={selectedTool} onSelect={setSelectedTool} />
        <LiveExecutor
          selected={selected}
          paramsJson={paramsJson}
          onParamsChange={setParamsJson}
          sensitivityLevel={sensitivityLevel}
          onSensitivityChange={setSensitivityLevel}
          sovereignMode={sovereignMode}
          onSovereignChange={setSovereignMode}
          approvalApproved={approvalApproved}
          onApprovalChange={setApprovalApproved}
          onExecute={onExecute}
          isRunning={execute.isPending}
          jsonError={jsonError}
          errorMessage={execute.error instanceof Error ? execute.error.message : null}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {pipeline?.steps ? (
          <PipelineVisualizer
            title="Tool Pipeline"
            subtitle={`${pipeline.total} canonical steps enforced on every call`}
            steps={pipeline.steps}
            run={lastResult?.steps}
            abortStep={lastResult?.abortStep}
            action={lastResult && (
              <span className={`rounded border px-2 py-1 text-[10px] font-mono uppercase ${lastResult.success ? 'border-s-success/30 bg-s-success/10 text-s-success' : 'border-s-critical/30 bg-s-critical/10 text-s-critical'}`}>
                {lastResult.success ? 'last run: success' : `last run: ${lastResult.aborted ? 'denied' : 'failed'}`}
              </span>
            )}
          />
        ) : (
          <Card>
            <CardHeader title="Tool Pipeline" subtitle="Loading canonical step definition" />
            <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Loading pipeline" />
          </Card>
        )}

        <LastExecutionPanel result={lastResult} />
      </div>
    </div>
  );
}

function ToolsTable({
  tools,
  selected,
  onSelect,
}: {
  tools: ToolDefinition[];
  selected: string;
  onSelect: (name: string) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, ToolDefinition[]>();
    for (const t of tools) {
      const list = map.get(t.category) ?? [];
      list.push(t);
      map.set(t.category, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tools]);

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Registered tools" subtitle="Click a tool to load it into the executor" />
      <div className="divide-y divide-s-border max-h-[480px] overflow-y-auto">
        {grouped.map(([category, list]) => (
          <div key={category}>
            <div className="px-4 py-2 bg-s-subtle/50 text-[10px] font-mono uppercase tracking-wider text-s-muted">
              {category}
            </div>
            {list.map((tool) => (
              <button
                key={tool.name}
                onClick={() => onSelect(tool.name)}
                className={`w-full text-left px-4 py-3 border-l-2 transition-colors min-w-0 ${
                  selected === tool.name
                    ? 'border-l-s-brand bg-s-brand/5'
                    : 'border-l-transparent hover:bg-s-hover'
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="text-[13px] font-mono text-s-primary truncate">{tool.name}</span>
                  <RiskBadge level={tool.riskLevel} />
                  {tool.requiresApproval && (
                    <span className="rounded border border-s-warning/30 bg-s-warning/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-s-warning">
                      approval
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-s-secondary leading-relaxed mt-1">{tool.description}</div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

function LiveExecutor({
  selected,
  paramsJson,
  onParamsChange,
  sensitivityLevel,
  onSensitivityChange,
  sovereignMode,
  onSovereignChange,
  approvalApproved,
  onApprovalChange,
  onExecute,
  isRunning,
  jsonError,
  errorMessage,
}: {
  selected: ToolDefinition | null;
  paramsJson: string;
  onParamsChange: (s: string) => void;
  sensitivityLevel: SensitivityLevel;
  onSensitivityChange: (s: SensitivityLevel) => void;
  sovereignMode: boolean;
  onSovereignChange: (v: boolean) => void;
  approvalApproved: boolean;
  onApprovalChange: (v: boolean) => void;
  onExecute: () => void;
  isRunning: boolean;
  jsonError: string | null;
  errorMessage: string | null;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Execute"
        subtitle={selected ? `Calling ${selected.name} through the runtime` : 'Select a tool from the list'}
        action={
          <Button
            variant="primary"
            size="sm"
            icon={isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            disabled={!selected || isRunning}
            onClick={onExecute}
          >
            {isRunning ? 'Running' : 'Execute'}
          </Button>
        }
      />
      <div className="p-4 space-y-3">
        {selected ? (
          <>
            <div>
              <Label>Parameters (JSON)</Label>
              <textarea
                value={paramsJson}
                onChange={(e) => onParamsChange(e.target.value)}
                rows={6}
                spellCheck={false}
                placeholder="Select a tool to load the required parameter schema."
                className="w-full px-3 py-2 rounded-md bg-s-subtle border border-s-border text-[12px] font-mono text-s-primary outline-none focus:border-s-brand/50 resize-y"
              />
              {jsonError && (
                <div className="mt-1 text-[11px] font-mono text-s-critical">JSON: {jsonError}</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sensitivity</Label>
                <select
                  value={sensitivityLevel}
                  onChange={(e) => onSensitivityChange(e.target.value as SensitivityLevel)}
                  className="w-full px-2 py-1.5 rounded-md bg-s-subtle border border-s-border text-[12px] text-s-primary outline-none focus:border-s-brand/50"
                >
                  <option value="public">public</option>
                  <option value="internal">internal</option>
                  <option value="confidential">confidential</option>
                  <option value="restricted">restricted</option>
                </select>
              </div>
              <div>
                <Label>Risk</Label>
                <div className="pt-1.5">
                  <RiskBadge level={selected.riskLevel} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Toggle label="Sovereign" checked={sovereignMode} onChange={onSovereignChange} />
              <Toggle label="Approval granted" checked={approvalApproved} onChange={onApprovalChange} />
            </div>

            {errorMessage && (
              <div className="rounded-md border border-s-critical/30 bg-s-critical/10 px-3 py-2 text-[11px] text-s-critical">
                {errorMessage}
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={<TerminalIcon size={18} />}
            title="No tool selected"
            description="Pick a tool from the registry on the left to configure and run it."
          />
        )}
      </div>
    </Card>
  );
}

function LastExecutionPanel({ result }: { result: ToolRuntimeResult | null }) {
  if (!result) {
    return (
      <Card>
        <CardHeader title="Last execution" subtitle="Results will appear here after the first run" />
        <EmptyState icon={<Play size={18} />} title="No executions yet" description="Use the executor panel to run a tool." />
      </Card>
    );
  }

  const outputPreview = (() => {
    try {
      const out = result.toolResult?.output;
      if (out === undefined) return '—';
      return typeof out === 'string' ? out : JSON.stringify(out, null, 2);
    } catch {
      return String(result.toolResult?.output ?? '');
    }
  })();

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Last execution"
        subtitle={`executionId: ${result.executionId} · ${result.durationMs}ms`}
        action={
          <span className={`rounded border px-2 py-1 text-[10px] font-mono uppercase ${result.success ? 'border-s-success/30 bg-s-success/10 text-s-success' : 'border-s-critical/30 bg-s-critical/10 text-s-critical'}`}>
            {result.success ? 'success' : result.aborted ? 'denied' : 'failed'}
          </span>
        }
      />
      <div className="p-4 space-y-3">
        {result.abortReason && (
          <div className="rounded-md border border-s-critical/30 bg-s-critical/10 px-3 py-2 text-[11px] text-s-critical">
            <div className="flex items-center gap-2 mb-1">
              <XCircle size={12} />
              <span className="font-mono uppercase text-[10px] tracking-wider">Aborted at {result.abortStep}</span>
            </div>
            <div>{result.abortReason}</div>
          </div>
        )}

        {result.policyDecision && (
          <div className="rounded-md border border-s-border bg-s-subtle px-3 py-2 text-[11px]">
            <div className="flex items-center gap-2 mb-1">
              <Shield size={12} className="text-s-brand" />
              <span className="font-mono uppercase text-[10px] tracking-wider text-s-muted">Policy decision</span>
              <SeverityBadge level={result.policyDecision.allowed ? 'LOW' : 'HIGH'} />
            </div>
            <div className="text-s-secondary">
              Matched: {result.policyDecision.matched.length ? result.policyDecision.matched.join(', ') : 'none'}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Tag ok={!result.sanitized.inputHadSecrets} label="Input clean" warnLabel="Secrets redacted" />
          <Tag ok={!result.sanitized.outputHadPII} label="Output clean" warnLabel="PII detected" />
        </div>

        <div>
          <Label>Output</Label>
          <pre className="max-h-[260px] overflow-auto rounded-md border border-s-border bg-s-base px-3 py-2 text-[11px] font-mono text-s-primary whitespace-pre-wrap break-words">
            {outputPreview}
          </pre>
        </div>
      </div>
    </Card>
  );
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const map: Record<RiskLevel, string> = {
    low: 'border-s-success/30 bg-s-success/10 text-s-success',
    medium: 'border-s-warning/30 bg-s-warning/10 text-s-warning',
    high: 'border-s-critical/30 bg-s-critical/10 text-s-critical',
    critical: 'border-s-critical/50 bg-s-critical/20 text-s-critical',
  };
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ${map[level]}`}>
      {level}
    </span>
  );
}

function buildParameterTemplate(tool: ToolDefinition): Record<string, unknown> {
  return Object.fromEntries(
    tool.parameters.map((param) => [param.name, param.default ?? emptyValueForParameter(param.type)]),
  );
}

function emptyValueForParameter(type: ToolDefinition['parameters'][number]['type']) {
  switch (type) {
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'object':
      return {};
    case 'array':
      return [];
    case 'string':
    default:
      return '';
  }
}

function Tag({ ok, label, warnLabel }: { ok: boolean; label: string; warnLabel: string }) {
  return (
    <div className={`rounded border px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-center ${ok ? 'border-s-success/30 bg-s-success/10 text-s-success' : 'border-s-warning/30 bg-s-warning/10 text-s-warning'}`}>
      {ok ? label : warnLabel}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div className="text-[10px] font-mono uppercase tracking-wider text-s-muted mb-1">{children}</div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 accent-s-brand"
      />
      <span className="text-[11px] text-s-secondary">{label}</span>
    </label>
  );
}
