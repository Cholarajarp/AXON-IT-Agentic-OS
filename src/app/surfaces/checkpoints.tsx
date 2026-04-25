import { useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  GitCommit,
  History,
  Loader2,
  RotateCcw,
  Save,
  ShieldCheck,
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
  useCheckpoints,
  useCreateCheckpoint,
  useMarkCheckpointRestored,
  usePreviewRollback,
  type ProjectCheckpoint,
  type RollbackPreview,
} from '../lib/queries';
import { useRouting } from '../lib/useRouting';

export function Checkpoints() {
  const checkpoints = useCheckpoints();
  const createCheckpoint = useCreateCheckpoint();
  const previewRollback = usePreviewRollback();
  const markRestored = useMarkCheckpointRestored();
  const { setRoute } = useRouting();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<ProjectCheckpoint | null>(null);
  const preview = previewRollback.data;

  const list = checkpoints.data?.checkpoints ?? [];
  const trackedArtifacts = list.reduce((total, item) => total + item.artifacts.length, 0);
  const restorePreviews = list.filter((item) => item.status === 'restore-previewed').length;

  const create = async () => {
    const checkpoint = await createCheckpoint.mutateAsync({
      name,
      description,
      scope: 'workspace',
      includePaths: [
        'package.json',
        'backend/package.json',
        'src/app/routes.tsx',
        'src/app/lib/queries.ts',
        'backend/src/index.ts',
        '.kiro/specs/competitive-ai-coding-platform-enhancements/tasks.md',
      ],
      metadata: { source: 'checkpoint-center' },
    });
    setSelected(checkpoint);
  };

  const runPreview = async (checkpoint: ProjectCheckpoint) => {
    setSelected(checkpoint);
    await previewRollback.mutateAsync(checkpoint.id);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Checkpoints"
        description="Save build states, preview rollback impact, and keep recovery auditable"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<ShieldCheck size={13} />} onClick={() => setRoute('security')}>
              Security
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={createCheckpoint.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              onClick={create}
              disabled={createCheckpoint.isPending || name.trim().length === 0}
            >
              {createCheckpoint.isPending ? 'Saving' : 'Create checkpoint'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Checkpoints" value={String(list.length)} hint="Saved states" />
        <Kpi label="Artifacts" value={String(trackedArtifacts)} hint="Tracked hashes" />
        <Kpi label="Rollback Previews" value={String(restorePreviews)} hint="Non-destructive" />
        <Kpi label="Selected" value={selected ? selected.scope : '--'} hint={selected?.status ?? 'None'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="Create checkpoint" subtitle="Save a recoverable build milestone" action={<GitCommit size={14} className="text-s-brand" />} />
          <div className="p-4 space-y-4">
            <label className="block">
              <span className="label-mono mb-1.5 block">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Checkpoint name tied to a real milestone"
                className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <label className="block">
              <span className="label-mono mb-1.5 block">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Why this state should be recoverable and what changed."
                className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <div className="rounded-md border border-s-border bg-s-base p-3">
              <div className="label-mono mb-2">Tracked by default</div>
              <div className="space-y-1.5">
                {['routes', 'API queries', 'backend index', 'package manifests', 'roadmap tasks'].map((item) => (
                  <div key={item} className="flex items-start gap-2 text-[12px] text-s-secondary">
                    <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-s-success" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <Button
              variant="primary"
              icon={createCheckpoint.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              onClick={create}
              disabled={createCheckpoint.isPending || name.trim().length === 0}
              className="w-full justify-center"
            >
              {createCheckpoint.isPending ? 'Creating checkpoint' : 'Create checkpoint'}
            </Button>
          </div>
        </Card>

        <CheckpointTimeline
          checkpoints={list}
          isLoading={checkpoints.isLoading}
          selectedId={selected?.id}
          onSelect={setSelected}
          onPreview={runPreview}
          previewingId={previewRollback.isPending ? selected?.id : undefined}
        />
      </div>

      <RollbackPanel
        selected={selected}
        preview={preview}
        onPreview={() => selected && runPreview(selected)}
        onMarkRestored={() => selected && markRestored.mutate(selected.id)}
        previewing={previewRollback.isPending}
        marking={markRestored.isPending}
      />
    </div>
  );
}

function CheckpointTimeline({
  checkpoints,
  isLoading,
  selectedId,
  previewingId,
  onSelect,
  onPreview,
}: {
  checkpoints: ProjectCheckpoint[];
  isLoading: boolean;
  selectedId?: string;
  previewingId?: string;
  onSelect: (checkpoint: ProjectCheckpoint) => void;
  onPreview: (checkpoint: ProjectCheckpoint) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Timeline" subtitle={`${checkpoints.length} checkpoint${checkpoints.length === 1 ? '' : 's'}`} action={<History size={14} className="text-s-brand" />} />
      {isLoading ? (
        <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Loading checkpoints" />
      ) : checkpoints.length === 0 ? (
        <EmptyState icon={<GitCommit size={18} />} title="No checkpoints yet" description="Create a checkpoint before the next autonomous build pass." />
      ) : (
        <div className="divide-y divide-s-border">
          {checkpoints.map((checkpoint) => {
            const selected = checkpoint.id === selectedId;
            return (
              <div key={checkpoint.id} className={`p-4 ${selected ? 'bg-s-brand/5' : 'hover:bg-s-hover'}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-s-border bg-s-base text-s-brand">
                    <GitCommit size={14} />
                  </div>
                  <button className="min-w-0 flex-1 text-left" onClick={() => onSelect(checkpoint)}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate text-[13px] font-medium text-s-primary">{checkpoint.name}</span>
                      <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono uppercase text-s-muted">
                        {checkpoint.scope}
                      </span>
                    </div>
                    <div className="mt-1 text-[11.5px] leading-relaxed text-s-secondary">{checkpoint.description}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono text-s-muted">
                      <span>{checkpoint.artifacts.length} artifacts</span>
                      <span>{checkpoint.status}</span>
                      <span>{new Date(checkpoint.createdAt).toLocaleString()}</span>
                    </div>
                  </button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={previewingId === checkpoint.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                    onClick={() => onPreview(checkpoint)}
                    disabled={previewingId === checkpoint.id}
                  >
                    Preview
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function RollbackPanel({
  selected,
  preview,
  previewing,
  marking,
  onPreview,
  onMarkRestored,
}: {
  selected: ProjectCheckpoint | null;
  preview?: RollbackPreview;
  previewing: boolean;
  marking: boolean;
  onPreview: () => void;
  onMarkRestored: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Rollback preview"
        subtitle={selected ? selected.name : 'Select a checkpoint'}
        action={preview ? <SeverityBadge level={preview.safeToRestore ? 'LOW' : 'HIGH'} /> : undefined}
      />
      {!selected ? (
        <EmptyState icon={<RotateCcw size={18} />} title="Select a checkpoint" description="Rollback previews show impact without changing files." />
      ) : !preview || preview.checkpointId !== selected.id ? (
        <EmptyState
          icon={<RotateCcw size={18} />}
          title="Preview required"
          description="Generate a non-destructive rollback preview before any restore decision."
          action={<Button size="sm" icon={previewing ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} onClick={onPreview}>Preview rollback</Button>}
        />
      ) : (
        <div className="p-4 space-y-4">
          <div className={`rounded-md border p-3 ${preview.safeToRestore ? 'border-s-success/30 bg-s-success/10' : 'border-s-warning/30 bg-s-warning/10'}`}>
            <div className="flex items-center gap-2 text-[13px] font-medium text-s-primary">
              {preview.safeToRestore ? <CheckCircle2 size={14} className="text-s-success" /> : <AlertTriangle size={14} className="text-s-warning" />}
              {preview.safeToRestore ? 'Safe for guarded restore' : 'Requires elevated approval'}
            </div>
            <div className="mt-1 text-[12px] leading-relaxed text-s-secondary">{preview.summary}</div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
            <div className="rounded-md border border-s-border bg-s-base">
              <div className="border-b border-s-border px-3 py-2 label-mono">Impacted artifacts</div>
              <div className="max-h-[360px] overflow-y-auto divide-y divide-s-border">
                {preview.impactedArtifacts.map((artifact) => (
                  <div key={artifact.path} className="flex items-center gap-2 px-3 py-2">
                    <span className={`h-2 w-2 rounded-full ${artifact.state === 'unchanged' ? 'bg-s-success' : artifact.state === 'changed' ? 'bg-s-warning' : 'bg-s-critical'}`} />
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-s-secondary">{artifact.path}</span>
                    <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono uppercase text-s-muted">
                      {artifact.state}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <InfoList title="Warnings" items={preview.warnings} icon={<AlertTriangle size={12} />} />
              <InfoList title="Next steps" items={preview.nextSteps} icon={<CheckCircle2 size={12} />} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={previewing ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              onClick={onPreview}
              disabled={previewing}
            >
              Refresh preview
            </Button>
            <Button
              variant="danger"
              icon={marking ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
              onClick={onMarkRestored}
              disabled={marking}
            >
              Mark restored
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function InfoList({ title, items, icon }: { title: string; items: string[]; icon: ReactNode }) {
  return (
    <div className="rounded-md border border-s-border bg-s-base p-3">
      <div className="label-mono mb-2">{title}</div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2 text-[11.5px] text-s-secondary">
            <span className="mt-0.5 shrink-0 text-s-brand">{icon}</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
