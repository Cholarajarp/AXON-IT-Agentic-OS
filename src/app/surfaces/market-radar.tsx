import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Compass,
  Loader2,
  Radar,
  Rocket,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import { Button, Card, CardHeader, EmptyState, Kpi, PageHeader, SeverityBadge } from '../components/ui/primitives';
import {
  useCompetitiveBenchmark,
  useCreateMoatActivationRun,
  useCreateMarketRadarReport,
  useLaunchMarketBuildPack,
  useMarketRadarReports,
  useMoatActivationRuns,
  type CompetitiveBenchmarkReport,
  type MarketBuildPack,
  type MarketRadarReport,
  type MoatActivationRun,
} from '../lib/queries';
import { useRouting } from '../lib/useRouting';
import { useToast } from '../lib/toast';

export function MarketRadar() {
  const reports = useMarketRadarReports();
  const benchmark = useCompetitiveBenchmark();
  const moatRuns = useMoatActivationRuns();
  const createReport = useCreateMarketRadarReport();
  const createMoatRun = useCreateMoatActivationRun();
  const launchPack = useLaunchMarketBuildPack();
  const { setRoute } = useRouting();
  const { toast } = useToast();
  const [focus, setFocus] = useState('');
  const [targetUser, setTargetUser] = useState('');
  const [selected, setSelected] = useState<MarketRadarReport | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [lastMoatRun, setLastMoatRun] = useState<MoatActivationRun | null>(null);

  const current = selected ?? reports.data?.reports[0] ?? null;
  const p0Count = current?.buildPacks.filter((pack) => pack.urgency === 'P0').length ?? 0;
  const topPack = current?.buildPacks[0] ?? null;
  const topGaps = useMemo(() => current?.gaps.slice(0, 6) ?? [], [current]);

  const runRadar = async () => {
    const report = await createReport.mutateAsync({ focus, targetUser, includeMoonshots: true });
    setSelected(report);
  };

  const launch = async (pack: MarketBuildPack) => {
    if (!current) return;
    setLaunchingId(pack.id);
    try {
      await launchPack.mutateAsync({ reportId: current.id, buildPackId: pack.id });
      setRoute('missionControl');
    } finally {
      setLaunchingId(null);
    }
  };

  const runMoatSprint = async () => {
    try {
      const run = await createMoatRun.mutateAsync({
        maxMissions: 3,
        tactic: 'Beat point competitors by closing the largest enterprise proof gaps first.',
      });
      setLastMoatRun(run);
      toast({ kind: 'success', title: 'Moat sprint created', description: `${run.missionControlRuns.length} Mission Control runs created.` });
    } catch (err) {
      toast({ kind: 'error', title: 'Moat sprint failed', description: err instanceof Error ? err.message : 'Unable to create moat sprint.' });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Market Radar"
        description="Market signals to AXON build packs, user benefits, moat, and Mission Control launches"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Rocket size={13} />} onClick={() => setRoute('missionControl')}>
              Missions
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={createReport.isPending ? <Loader2 size={13} className="animate-spin" /> : <Radar size={13} />}
              onClick={runRadar}
              disabled={createReport.isPending || focus.trim().length < 12}
            >
              {createReport.isPending ? 'Scanning' : 'Scan market'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Moat Score" value={current ? `${current.moatScore}%` : '--'} hint="Current strategy strength" />
        <Kpi label="Signals" value={String(current?.signals.length ?? 0)} hint="Reference inputs" />
        <Kpi label="P0 Packs" value={String(p0Count)} hint="Build immediately" />
        <Kpi label="Top Pack" value={topPack ? `${topPack.impactScore}` : '--'} hint={topPack?.name ?? 'No scan'} />
      </div>

      <CompetitiveCommand
        benchmark={benchmark.data ?? null}
        activationRuns={moatRuns.data?.runs ?? []}
        lastMoatRun={lastMoatRun}
        busy={createMoatRun.isPending}
        onRunMoatSprint={runMoatSprint}
        onOpenMissions={() => setRoute('missionControl')}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)] gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="Strategy scan" subtitle="Tell AXON what user outcome to dominate" action={<Compass size={14} className="text-s-brand" />} />
          <div className="p-4 space-y-4">
            <label className="block">
              <span className="label-mono mb-1.5 block">Focus</span>
              <textarea
                value={focus}
                onChange={(event) => setFocus(event.target.value)}
                rows={6}
                placeholder="Describe the user segment, product ambition, risk level, and capabilities to investigate."
                className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <label className="block">
              <span className="label-mono mb-1.5 block">Target users</span>
              <input
                value={targetUser}
                onChange={(event) => setTargetUser(event.target.value)}
                placeholder="Target users or customer segment"
                className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <Button
              variant="primary"
              icon={createReport.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              onClick={runRadar}
              disabled={createReport.isPending || focus.trim().length < 12}
              className="w-full justify-center"
            >
              {createReport.isPending ? 'Compiling build packs' : 'Generate monster roadmap'}
            </Button>
          </div>
        </Card>

        <ReportOverview report={current} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
        <BuildPacksPanel report={current} launchingId={launchingId} onLaunch={launch} />
        <GapsPanel gaps={topGaps} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SignalsPanel report={current} />
        <CoveragePanel report={current} />
      </div>
    </div>
  );
}

function CompetitiveCommand({
  benchmark,
  activationRuns,
  lastMoatRun,
  busy,
  onRunMoatSprint,
  onOpenMissions,
}: {
  benchmark: CompetitiveBenchmarkReport | null;
  activationRuns: MoatActivationRun[];
  lastMoatRun: MoatActivationRun | null;
  busy: boolean;
  onRunMoatSprint: () => void;
  onOpenMissions: () => void;
}) {
  const run = lastMoatRun ?? activationRuns[0] ?? null;
  const topCapabilities = benchmark?.capabilities.slice(0, 4) ?? [];

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Competitive command"
        subtitle={benchmark ? benchmark.sourceWindow : 'Live competitor benchmark loading'}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Rocket size={13} />} onClick={onOpenMissions}>
              Mission runs
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={busy ? <Loader2 size={13} className="animate-spin" /> : <Trophy size={13} />}
              onClick={onRunMoatSprint}
              disabled={busy || !benchmark}
            >
              {busy ? 'Creating' : 'Run moat sprint'}
            </Button>
          </div>
        }
      />
      {benchmark ? (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[190px_minmax(0,1fr)] gap-4">
            <div className="rounded-md border border-s-border bg-s-base p-4">
              <div className="label-mono mb-2">AXON vs market</div>
              <div className="font-mono text-s-primary text-[34px] leading-none">{benchmark.overallScore}%</div>
              <div className="mt-2 h-2 rounded-full bg-s-subtle overflow-hidden">
                <div className="h-full rounded-full bg-s-brand" style={{ width: `${benchmark.overallScore}%` }} />
              </div>
              <div className="mt-2 text-[11.5px] leading-relaxed text-s-secondary">Target: 95% enterprise-ready operating system posture.</div>
            </div>
            <div className="rounded-md border border-s-brand/30 bg-s-brand/10 p-4 text-[12.5px] leading-relaxed text-s-primary">
              {benchmark.thesis}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
            <div className="rounded-md border border-s-border bg-s-base overflow-hidden">
              <div className="border-b border-s-border px-3 py-2 label-mono">Capability gap leaderboard</div>
              <div className="divide-y divide-s-border">
                {topCapabilities.map((capability) => (
                  <div key={capability.id} className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{capability.title}</span>
                      <span className="font-mono text-[11px] text-s-muted">{capability.score}/{capability.targetScore}</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-s-subtle overflow-hidden">
                      <div className="h-full rounded-full bg-s-brand" style={{ width: `${capability.score}%` }} />
                    </div>
                    <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{capability.nextMove}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {capability.competitorLeaders.map((leader) => <Token key={leader}>{leader}</Token>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-s-border bg-s-base overflow-hidden">
              <div className="border-b border-s-border px-3 py-2 label-mono">Moat lanes</div>
              <div className="divide-y divide-s-border">
                {benchmark.moatLanes.map((lane) => (
                  <div key={lane.id} className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{lane.title}</span>
                      <span className="font-mono text-[11px] text-s-muted">{lane.score}%</span>
                    </div>
                    <div className="mt-1 text-[12px] leading-relaxed text-s-secondary">{lane.winCondition}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">{lane.ownerModules.map((module) => <Token key={module}>{module}</Token>)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
            <CompetitorMatrix benchmark={benchmark} />
            <MoatRunPanel run={run} />
          </div>
        </div>
      ) : (
        <EmptyState icon={<Radar size={18} />} title="Competitive benchmark loading" />
      )}
    </Card>
  );
}

function CompetitorMatrix({ benchmark }: { benchmark: CompetitiveBenchmarkReport }) {
  return (
    <div className="rounded-md border border-s-border bg-s-base overflow-hidden">
      <div className="border-b border-s-border px-3 py-2 label-mono">Competitor counter-moves</div>
      <div className="divide-y divide-s-border">
        {benchmark.competitors.map((competitor) => (
          <div key={competitor.id} className="p-3">
            <div className="flex items-center gap-2">
              <Token>{competitor.category}</Token>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{competitor.name}</span>
            </div>
            <div className="mt-2 grid grid-cols-1 lg:grid-cols-3 gap-2">
              <CounterCell title="Their edge">{competitor.currentEdge}</CounterCell>
              <CounterCell title="Their gap">{competitor.weakSpot}</CounterCell>
              <CounterCell title="AXON counter">{competitor.axonCounter}</CounterCell>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MoatRunPanel({ run }: { run: MoatActivationRun | null }) {
  const progress = run?.progress ?? { score: 0, completedGates: 0, totalGates: 0 };
  const missionRuns = run?.missionControlRuns ?? [];
  const proofArtifacts = run?.proofArtifacts ?? [];
  const risks = run?.riskRegister ?? [];

  return (
    <div className="rounded-md border border-s-border bg-s-base overflow-hidden">
      <div className="border-b border-s-border px-3 py-2 label-mono">Latest moat sprint</div>
      {run ? (
        <div className="p-3">
            <div className="flex items-center gap-2">
              <Token>{run.status}</Token>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{run.id}</span>
            <span className="font-mono text-[11px] text-s-muted">{progress.score}%</span>
          </div>
          <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{run.summary}</div>
          <div className="mt-3 rounded-md border border-s-border bg-s-subtle p-2">
            <div className="flex items-center justify-between text-[11.5px]">
              <span className="text-s-secondary">Stage gates</span>
              <span className="font-mono text-s-primary">{progress.completedGates}/{progress.totalGates}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-s-base overflow-hidden">
              <div className="h-full rounded-full bg-s-brand" style={{ width: `${progress.score}%` }} />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {missionRuns.map((mission) => (
              <div key={mission.missionControlRunId} className="rounded-md border border-s-border bg-s-subtle p-2">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-s-primary">{mission.capabilityTitle}</span>
                  <span className="font-mono text-[10px] text-s-muted">{mission.score ?? '--'}</span>
                </div>
                <div className="mt-1 font-mono text-[10px] text-s-muted">{mission.missionControlRunId}</div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <div className="label-mono mb-2">Proof artifacts</div>
            <div className="space-y-1.5">
              {proofArtifacts.map((artifact) => (
                <div key={artifact.id} className="rounded-md border border-s-border bg-s-subtle p-2">
                  <div className="flex items-center gap-2">
                    <Token>{artifact.kind}</Token>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-s-primary">{artifact.name}</span>
                  </div>
                  <div className="mt-1 truncate font-mono text-[9.5px] text-s-muted">{artifact.sha256}</div>
                </div>
              ))}
              {proofArtifacts.length === 0 && <div className="rounded-md border border-s-border bg-s-subtle p-2 text-[11px] text-s-muted">Legacy sprint has no artifact manifest. Run a new moat sprint to create signed proof.</div>}
            </div>
          </div>
          <div className="mt-3">
            <div className="label-mono mb-2">Top risks</div>
            <div className="space-y-1.5">
              {risks.slice(0, 3).map((risk) => (
                <div key={risk.id} className="rounded-md border border-s-border bg-s-subtle p-2">
                  <div className="flex items-center gap-2">
                    <Token>{risk.severity}</Token>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-s-primary">{risk.title}</span>
                  </div>
                  <div className="mt-1 text-[10.5px] leading-relaxed text-s-secondary">{risk.mitigation}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 text-[11px] text-s-muted">Next review {new Date(run.nextReviewAt || Date.now()).toLocaleDateString()}</div>
        </div>
      ) : (
        <EmptyState icon={<Trophy size={18} />} title="No moat sprint yet" description="Run a sprint to create real Mission Control work from the largest competitor gaps." />
      )}
    </div>
  );
}

function CounterCell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-s-border bg-s-subtle p-2">
      <div className="label-mono mb-1">{title}</div>
      <div className="text-[11.5px] leading-relaxed text-s-secondary">{children}</div>
    </div>
  );
}

function ReportOverview({ report }: { report: MarketRadarReport | null }) {
  if (!report) {
    return (
      <Card>
        <CardHeader title="Market posture" subtitle="No scan yet" />
        <EmptyState icon={<Radar size={18} />} title="Run Market Radar" description="AXON will convert market signals into build packs, gaps, moat, and launchable missions." />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Market thesis" subtitle={new Date(report.generatedAt).toLocaleString()} action={<SeverityBadge level={report.moatScore >= 90 ? 'LOW' : report.moatScore >= 75 ? 'MEDIUM' : 'HIGH'} />} />
      <div className="p-4 space-y-4">
        <div className="rounded-md border border-s-border bg-s-base p-4 text-[12px] leading-relaxed text-s-secondary">{report.marketThesis}</div>
        <div className="rounded-md border border-s-brand/30 bg-s-brand/10 p-4 text-[12px] leading-relaxed text-s-primary">{report.summary}</div>
        <div className="rounded-md border border-s-border bg-s-base p-3">
          <div className="label-mono mb-2">Recommended sequence</div>
          <div className="space-y-2">
            {report.recommendedSequence.map((item) => (
              <div key={item.buildPackId} className="flex items-start gap-2 text-[12px] leading-relaxed text-s-secondary">
                <span className="mt-0.5 rounded border border-s-border bg-s-subtle px-1.5 py-0.5 font-mono text-[9px] text-s-muted">{item.order}</span>
                <span>{item.rationale}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function BuildPacksPanel({ report, launchingId, onLaunch }: { report: MarketRadarReport | null; launchingId: string | null; onLaunch: (pack: MarketBuildPack) => void }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Build packs" subtitle={report ? `${report.buildPacks.length} prioritized packs` : 'No scan'} action={<Trophy size={14} className="text-s-brand" />} />
      <div className="divide-y divide-s-border">
        {(report?.buildPacks ?? []).map((pack) => (
          <div key={pack.id} className="p-4">
            <div className="flex items-center gap-2 min-w-0">
              <SeverityBadge level={pack.urgency} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{pack.name}</span>
              <span className="font-mono text-[11px] text-s-muted">{pack.impactScore}</span>
              <Button size="sm" variant="secondary" icon={launchingId === pack.id ? <Loader2 size={12} className="animate-spin" /> : <Rocket size={12} />} onClick={() => onLaunch(pack)} disabled={Boolean(launchingId)}>
                Launch
              </Button>
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{pack.whyNow}</div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-primary">{pack.userBenefit}</div>
            <div className="mt-3 flex flex-wrap gap-1.5">{pack.modules.map((item) => <Token key={item}>{item}</Token>)}</div>
            <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <MiniList title="Features" items={pack.features} icon={<Target size={12} className="text-s-info" />} />
              <MiniList title="Acceptance" items={pack.acceptanceCriteria} icon={<CheckCircle2 size={12} className="text-s-success" />} />
            </div>
          </div>
        ))}
        {!report && <EmptyState icon={<Sparkles size={18} />} title="No build packs yet" />}
      </div>
    </Card>
  );
}

function GapsPanel({ gaps }: { gaps: MarketRadarReport['gaps'] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Capability gaps" subtitle={`${gaps.length} top gaps`} action={<AlertTriangle size={14} className="text-s-warning" />} />
      <div className="divide-y divide-s-border">
        {gaps.map((gap) => (
          <div key={gap.id} className="p-4">
            <div className="flex items-center gap-2 min-w-0">
              <SeverityBadge level={gap.urgency} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{gap.title}</span>
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{gap.userBenefit}</div>
            <div className="mt-3 label-mono">Missing</div>
            <div className="mt-2 space-y-1.5">{gap.missing.map((item) => <Line key={item} icon={<AlertTriangle size={12} className="text-s-warning" />}>{item}</Line>)}</div>
          </div>
        ))}
        {gaps.length === 0 && <EmptyState icon={<BarChart3 size={18} />} title="No gaps yet" />}
      </div>
    </Card>
  );
}

function SignalsPanel({ report }: { report: MarketRadarReport | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Market signals" subtitle={report ? `${report.signals.length} sources` : 'No scan'} />
      <div className="divide-y divide-s-border max-h-[560px] overflow-y-auto">
        {(report?.signals ?? []).map((signal) => (
          <div key={signal.id} className="p-4">
            <div className="flex items-center gap-2 min-w-0">
              <Token>{signal.source}</Token>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{signal.observedCapability}</span>
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{signal.strategicIntent}</div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-primary">{signal.axonResponse}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">{signal.areas.map((area) => <Token key={area}>{area}</Token>)}</div>
          </div>
        ))}
        {!report && <EmptyState icon={<Radar size={18} />} title="No market signals yet" />}
      </div>
    </Card>
  );
}

function CoveragePanel({ report }: { report: MarketRadarReport | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Reference coverage" subtitle={report ? `${report.referenceCoverage.length} sources` : 'No scan'} />
      <div className="divide-y divide-s-border">
        {(report?.referenceCoverage ?? []).map((item) => (
          <div key={item.source} className="p-4">
            <div className="flex items-center gap-2">
              <Token>{item.source}</Token>
              <span className="ml-auto font-mono text-[11px] text-s-muted">{item.signals} signal(s)</span>
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{item.axonResponse}</div>
          </div>
        ))}
        {!report && <EmptyState icon={<Trophy size={18} />} title="No reference coverage yet" />}
      </div>
    </Card>
  );
}

function MiniList({ title, items, icon }: { title: string; items: string[]; icon: ReactNode }) {
  return (
    <div className="rounded-md border border-s-border bg-s-base p-3">
      <div className="label-mono mb-2">{title}</div>
      <div className="space-y-1.5">{items.slice(0, 5).map((item) => <Line key={item} icon={icon}>{item}</Line>)}</div>
    </div>
  );
}

function Line({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[12px] leading-relaxed text-s-secondary">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function Token({ children }: { children: ReactNode }) {
  return <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[10px] font-mono text-s-muted">{children}</span>;
}
