import { useState } from "react";
import { Brain, Search, Database, Layers, Clock, Zap, Tag, ExternalLink } from "lucide-react";
import { Card, CardHeader, PageHeader, Button } from "../components/ui/primitives";
import { useMemoryAll } from "../lib/queries";
import type { MemoryRecord } from "../lib/queries";

const typeConfig = {
  semantic: { label: "Semantic", icon: Database, color: "bg-s-brand/10 text-s-brand border-s-brand/30" },
  episodic: { label: "Episodic", icon: Clock, color: "bg-s-warning/10 text-s-warning border-s-warning/30" },
  procedural: { label: "Procedural", icon: Layers, color: "bg-s-success/10 text-s-success border-s-success/30" },
};

export function Memory() {
  const { data: records = [] } = useMemoryAll();
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "semantic" | "episodic" | "procedural">("all");
  const [selected, setSelected] = useState<MemoryRecord | null>(null);

  const filtered = records.filter((r) => {
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    if (q) {
      const query = q.toLowerCase();
      return (
        r.content.toLowerCase().includes(query) ||
        r.tags.some((t) => t.includes(query)) ||
        r.source.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const counts = {
    total: records.length,
    semantic: records.filter((r) => r.type === "semantic").length,
    episodic: records.filter((r) => r.type === "episodic").length,
    procedural: records.filter((r) => r.type === "procedural").length,
  };

  return (
    <div>
      <PageHeader
        title="Memory"
        description="Long-term knowledge, episodic recall, and procedural memory accessed by the agent fleet"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm">Configure Stores</Button>
            <Button variant="secondary" size="sm">Flush Cache</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Card className="p-4 overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <Brain size={14} className="text-s-muted" />
            <span className="label-mono">Total Records</span>
          </div>
          <div className="font-mono text-s-primary text-2xl font-medium tabular-nums">{counts.total}</div>
        </Card>
        <Card className="p-4 overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <Database size={14} className="text-s-brand" />
            <span className="label-mono">Semantic</span>
          </div>
          <div className="font-mono text-s-primary text-2xl font-medium tabular-nums">{counts.semantic}</div>
        </Card>
        <Card className="p-4 overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-s-warning" />
            <span className="label-mono">Episodic</span>
          </div>
          <div className="font-mono text-s-primary text-2xl font-medium tabular-nums">{counts.episodic}</div>
        </Card>
        <Card className="p-4 overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <Layers size={14} className="text-s-success" />
            <span className="label-mono">Procedural</span>
          </div>
          <div className="font-mono text-s-primary text-2xl font-medium tabular-nums">{counts.procedural}</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-s-border gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 max-w-lg px-3 py-2 rounded-md bg-s-subtle border border-s-border min-w-[200px]">
            <Search size={14} className="text-s-muted shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search memory by content, tags, or source agent..."
              className="bg-transparent flex-1 min-w-0 outline-none text-s-primary placeholder:text-s-muted text-[13px]"
            />
          </div>
          <div className="flex items-center gap-1 p-0.5 rounded-md bg-s-subtle border border-s-border">
            {(["all", "semantic", "episodic", "procedural"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  typeFilter === t ? "bg-s-surface text-s-primary shadow-sm" : "text-s-secondary hover:text-s-primary"
                }`}
              >
                {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-s-border">
          {filtered.map((record) => (
            <MemoryRow key={record.id} record={record} onClick={() => setSelected(record)} isSelected={selected?.id === record.id} />
          ))}
        </div>
      </Card>

      {selected && (
        <Card className="mt-4 overflow-hidden">
          <CardHeader title="Memory Detail" subtitle={selected.id} />
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <div className="label-mono mb-1">Type</div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] ${typeConfig[selected.type].color}`}>
                  {typeConfig[selected.type].label}
                </span>
              </div>
              <div>
                <div className="label-mono mb-1">Source</div>
                <span className="text-s-primary font-mono text-xs">{selected.source}</span>
              </div>
              <div>
                <div className="label-mono mb-1">Confidence</div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-s-subtle rounded-full overflow-hidden">
                    <div className="h-full bg-s-brand rounded-full" style={{ width: `${selected.confidence * 100}%` }} />
                  </div>
                  <span className="font-mono text-s-primary text-xs">{(selected.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-md bg-s-base border border-s-border mb-4">
              <div className="text-s-primary text-[13px] leading-relaxed">{selected.content}</div>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1 text-s-muted text-[11px]">
                <Zap size={10} /> {selected.accessCount} retrievals
              </span>
              <span className="flex items-center gap-1 text-s-muted text-[11px]">
                <Clock size={10} /> Last: {formatAge(Date.now() - selected.lastAccessed)}
              </span>
              {selected.relatedWorkflows.length > 0 && (
                <span className="flex items-center gap-1 text-s-muted text-[11px]">
                  <ExternalLink size={10} /> {selected.relatedWorkflows.length} workflows
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {selected.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded bg-s-subtle border border-s-border text-s-secondary text-[10.5px]">
                  <Tag size={9} /> {tag}
                </span>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function MemoryRow({ record, onClick, isSelected }: { record: MemoryRecord; onClick: () => void; isSelected: boolean }) {
  const cfg = typeConfig[record.type];
  const Icon = cfg.icon;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-5 py-4 hover:bg-s-hover transition-colors ${isSelected ? "bg-s-hover" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 w-7 h-7 rounded-md bg-s-subtle border border-s-border flex items-center justify-center shrink-0">
          <Icon size={13} className="text-s-secondary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9.5px] font-medium ${cfg.color}`}>
              {cfg.label}
            </span>
            <span className="text-s-muted font-mono text-[10px]">{record.source}</span>
            <span className="ml-auto flex items-center gap-1 text-s-muted text-[10px] shrink-0">
              <Zap size={9} /> {(record.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="text-s-primary text-[12.5px] leading-relaxed truncate">
            {record.content}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-s-muted text-[10.5px]">{record.accessCount} retrievals</span>
            <span className="text-s-muted text-[10.5px]">{formatAge(Date.now() - record.lastAccessed)}</span>
            <div className="flex gap-1 ml-auto">
              {record.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="px-1.5 py-0.5 rounded bg-s-subtle text-s-muted text-[9.5px]">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

function formatAge(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
