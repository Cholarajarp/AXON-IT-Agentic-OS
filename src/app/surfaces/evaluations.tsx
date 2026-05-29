import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Gauge,
  GitCompareArrows,
  Loader2,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  TestTubeDiagonal,
  Timer,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button, Card, CardHeader, EmptyState, Kpi, PageHeader, SeverityBadge } from "../components/ui/primitives";
import { useModelEvaluationReport, useRunModelEvaluation, type EvalCaseResult } from "../lib/queries";
import { useToast } from "../lib/toast";

const gateIcon = {
  pass: CheckCircle2,
  warn: AlertTriangle,
  fail: XCircle,
};

const gateColor = {
  pass: "text-s-success",
  warn: "text-s-warning",
  fail: "text-s-critical",
};

export function Evaluations() {
  const evaluations = useModelEvaluationReport();
  const runEvaluation = useRunModelEvaluation();
  const { toast } = useToast();
  const report = evaluations.data?.report;
  const gates = evaluations.data?.gates ?? [];
  const runtime = evaluations.data?.runtime;
  const passRate = report && report.total > 0 ? Math.round((report.passed / report.total) * 100) : 0;
  const releaseBlocked = Boolean(report?.failed) || gates.some((gate) => gate.status === "fail");

  const handleRunEvaluation = async () => {
    try {
      const result = await runEvaluation.mutateAsync({ includeAdversarial: true });
      toast({
        kind: result.report.failed > 0 ? "warning" : "success",
        title: "Evaluation run complete",
        description: `${result.run.id}: ${result.report.passed}/${result.report.total} cases passed.`,
      });
    } catch (err) {
      toast({ kind: "error", title: "Evaluation run failed", description: err instanceof Error ? err.message : "Unable to run model evaluations." });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Evaluation Lab"
        description="Backend-run model router regression, provider health, and release quality gates"
        action={
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" icon={<PlayCircle size={13} />} onClick={handleRunEvaluation} disabled={runEvaluation.isPending}>
              {runEvaluation.isPending ? "Running" : "Run eval"}
            </Button>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={13} />} onClick={() => evaluations.refetch()}>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Cases Passing" value={report ? `${report.passed}/${report.total}` : "--"} hint="Router eval harness" />
        <Kpi label="Pass Rate" value={report ? `${passRate}%` : "--"} delta={report?.failed ? `${report.failed} failed` : "green"} trend={report?.failed ? "down" : "up"} />
        <Kpi label="Duration" value={report ? `${report.durationMs}ms` : "--"} hint="Last backend run" />
        <Kpi label="Release Gate" value={releaseBlocked ? "Blocked" : "Open"} delta={releaseBlocked ? "Fix evals" : "Passing"} trend={releaseBlocked ? "down" : "up"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
        <Card className="overflow-hidden">
          <CardHeader
            title="Production release gates"
            subtitle={evaluations.data ? `Generated ${new Date(evaluations.data.generatedAt).toLocaleString()}` : "Waiting for backend report"}
            action={<SeverityBadge level={releaseBlocked ? "HIGH" : "LOW"} />}
          />
          {evaluations.isLoading ? (
            <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Running evaluation report" />
          ) : evaluations.isError ? (
            <EmptyState icon={<AlertTriangle size={18} />} title="Evaluation endpoint failed" description={evaluations.error instanceof Error ? evaluations.error.message : "Unable to load model evaluations."} />
          ) : gates.length === 0 ? (
            <EmptyState icon={<TestTubeDiagonal size={18} />} title="No gates returned" />
          ) : (
            <div className="divide-y divide-s-border">
              {gates.map((gate) => {
                const Icon = gateIcon[gate.status];
                return (
                  <div key={gate.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon size={14} className={gateColor[gate.status]} />
                          <span className="text-s-primary text-[13px] font-medium truncate">{gate.title}</span>
                          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-s-subtle text-s-secondary border border-s-border">
                            {gate.status}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {gate.evidence.map((item) => (
                            <span key={item} className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[10px] font-mono text-s-muted">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="font-mono text-s-primary text-[13px] shrink-0">{gate.score}%</div>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-s-subtle overflow-hidden">
                      <div
                        className={`h-full rounded-full ${gate.status === "fail" ? "bg-s-critical" : gate.status === "warn" ? "bg-s-warning" : "bg-s-success"}`}
                        style={{ width: `${gate.score}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Evaluation architecture" subtitle="How AXON keeps agents useful and safe" />
          <div className="p-4 space-y-3">
            {[
              { icon: GitCompareArrows, title: "Prompt snapshots", desc: "Prompts and router behavior are versioned against regression cases." },
              { icon: ShieldAlert, title: "Adversarial probes", desc: "Injection, exfiltration, and unsafe tool requests are replayed before rollout." },
              { icon: Gauge, title: "Confidence calibration", desc: "Low-confidence answers should trigger retrieval or critic review." },
              { icon: Timer, title: "Latency budgets", desc: "Model routes fail closed when p95 latency violates workflow SLOs." },
              { icon: BarChart3, title: "Feedback loop", desc: "Approvals and incidents become future eval cases instead of forgotten notes." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-3">
                  <Icon size={14} className="text-s-brand mt-0.5" />
                  <div>
                    <div className="text-s-primary text-[12.5px] font-medium">{item.title}</div>
                    <div className="text-s-secondary text-[11.5px]">{item.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
        <EvalCasesPanel cases={report?.results ?? []} />
        <Card className="overflow-hidden">
          <CardHeader title="Runtime provider evidence" subtitle={`${runtime?.healthyProviders ?? 0}/${runtime?.providers.length ?? 0} healthy providers`} />
          <div className="divide-y divide-s-border">
            {(runtime?.health ?? []).map((provider) => (
              <div key={provider.name} className="p-4">
                <div className="flex items-center gap-2">
                  {provider.healthy ? <CheckCircle2 size={14} className="text-s-success" /> : <AlertTriangle size={14} className="text-s-warning" />}
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{provider.name}</span>
                  <span className="font-mono text-[10px] text-s-muted">{provider.avgLatencyMs}ms avg</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Token>{provider.totalRequests} requests</Token>
                  <Token>{provider.totalFailures} failures</Token>
                  <Token>{provider.consecutiveFailures} consecutive</Token>
                </div>
              </div>
            ))}
            {!runtime?.health.length && <EmptyState icon={<Gauge size={18} />} title="No provider health yet" />}
          </div>
        </Card>
      </div>
    </div>
  );
}

function EvalCasesPanel({ cases }: { cases: EvalCaseResult[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Regression cases" subtitle={`${cases.length} backend eval case${cases.length === 1 ? "" : "s"}`} />
      <div className="divide-y divide-s-border">
        {cases.map((item) => (
          <div key={item.id} className="p-4">
            <div className="flex items-center gap-2">
              {item.passed ? <CheckCircle2 size={14} className="text-s-success" /> : <XCircle size={14} className="text-s-critical" />}
              <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-s-primary">{item.id}</span>
              <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono uppercase text-s-muted">
                {item.passed ? "pass" : "fail"}
              </span>
            </div>
            {item.reasons.length > 0 && (
              <div className="mt-2 space-y-1">
                {item.reasons.map((reason) => (
                  <div key={reason} className="text-[12px] leading-relaxed text-s-warning">{reason}</div>
                ))}
              </div>
            )}
            {item.response && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Token>{item.response.provider}</Token>
                <Token>{item.response.model}</Token>
                <Token>${item.response.cost.toFixed(4)}</Token>
                <Token>{item.response.latencyMs}ms</Token>
              </div>
            )}
          </div>
        ))}
        {cases.length === 0 && <EmptyState icon={<TestTubeDiagonal size={18} />} title="No regression cases returned" />}
      </div>
    </Card>
  );
}

function Token({ children }: { children: ReactNode }) {
  return <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[10px] font-mono text-s-muted">{children}</span>;
}
