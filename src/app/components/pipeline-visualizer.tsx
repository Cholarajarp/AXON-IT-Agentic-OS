import type { ReactNode } from 'react';
import { Check, X, Shield, Clock, AlertCircle } from 'lucide-react';
import { Card, CardHeader } from './ui/primitives';

/**
 * Pipeline visualizer.
 *
 * Renders a sequence of governance steps as a vertical spine. Used for:
 *   - /agents/pipeline (13-step agent execution)
 *   - /tools/pipeline  (13-step tool execution)
 *   - ad-hoc "last execution" views that show which step a request aborted at.
 *
 * In "live" mode (stepsRun provided), steps are colored by pass/fail/skipped
 * and the aborted step is highlighted.
 */

export interface PipelineStep {
  order: number;
  name: string;
  description: string;
}

export interface PipelineStepRun {
  step: string;
  order: number;
  passed: boolean;
  durationMs: number;
  message?: string;
}

interface Props {
  title: string;
  subtitle?: string;
  steps: PipelineStep[];
  run?: PipelineStepRun[];
  abortStep?: string;
  action?: ReactNode;
}

export function PipelineVisualizer({ title, subtitle, steps, run, abortStep, action }: Props) {
  const runByName = new Map<string, PipelineStepRun>((run ?? []).map((r) => [r.step, r]));

  return (
    <Card className="overflow-hidden">
      <CardHeader title={title} subtitle={subtitle} action={action} />
      <div className="p-4">
        <ol className="relative space-y-3">
          <div className="absolute left-[15px] top-1 bottom-1 w-px bg-s-border" aria-hidden />

          {steps.map((step) => {
            const runEntry = runByName.get(step.name);
            const isAborted = abortStep === step.name;
            const state = stateFor(runEntry, isAborted, run);
            return (
              <li key={step.name} className="relative flex gap-3 items-start min-w-0">
                <StepMarker state={state} order={step.order} />
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-medium text-s-primary truncate">{humanize(step.name)}</span>
                    <StateChip state={state} />
                    {runEntry && (
                      <span className="text-[10px] font-mono text-s-muted">{runEntry.durationMs}ms</span>
                    )}
                  </div>
                  <div className="text-[11px] text-s-secondary leading-relaxed mt-0.5">{step.description}</div>
                  {runEntry?.message && (
                    <div className={`mt-1 text-[11px] font-mono ${state === 'failed' ? 'text-s-critical' : 'text-s-muted'}`}>
                      {runEntry.message}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
}

type StepState = 'pending' | 'passed' | 'failed' | 'skipped' | 'canonical';

function stateFor(run: PipelineStepRun | undefined, aborted: boolean, allRun: PipelineStepRun[] | undefined): StepState {
  if (!allRun) return 'canonical';
  if (aborted) return 'failed';
  if (!run) return 'skipped';
  return run.passed ? 'passed' : 'failed';
}

function StepMarker({ state, order }: { state: StepState; order: number }) {
  const classes: Record<StepState, string> = {
    pending: 'bg-s-subtle border-s-border text-s-muted',
    passed: 'bg-s-success/15 border-s-success/40 text-s-success',
    failed: 'bg-s-critical/15 border-s-critical/40 text-s-critical',
    skipped: 'bg-s-subtle border-s-border text-s-muted',
    canonical: 'bg-s-brand/10 border-s-brand/30 text-s-brand',
  };
  const icon: Record<StepState, ReactNode> = {
    pending: <Clock size={11} />,
    passed: <Check size={11} />,
    failed: <X size={11} />,
    skipped: <Shield size={11} />,
    canonical: <span className="text-[9px] font-mono leading-none">{order}</span>,
  };
  return (
    <div className={`relative z-10 shrink-0 w-[30px] h-[30px] rounded-full border flex items-center justify-center ${classes[state]}`}>
      {icon[state]}
    </div>
  );
}

function StateChip({ state }: { state: StepState }) {
  if (state === 'canonical') {
    return (
      <span className="rounded border border-s-brand/30 bg-s-brand/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-s-brand">
        canonical
      </span>
    );
  }
  const map: Record<StepState, { label: string; cls: string; icon: ReactNode }> = {
    pending: { label: 'pending', cls: 'border-s-border text-s-muted', icon: null },
    passed:  { label: 'passed', cls: 'border-s-success/30 bg-s-success/10 text-s-success', icon: null },
    failed:  { label: 'failed', cls: 'border-s-critical/30 bg-s-critical/10 text-s-critical', icon: <AlertCircle size={10} /> },
    skipped: { label: 'skipped', cls: 'border-s-border text-s-muted', icon: null },
    canonical: { label: '', cls: '', icon: null },
  };
  const m = map[state];
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ${m.cls}`}>
      {m.icon}
      {m.label}
    </span>
  );
}

function humanize(name: string): string {
  return name.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
