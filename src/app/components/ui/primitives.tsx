import { type ReactNode, type ButtonHTMLAttributes, useEffect } from "react";
import { X } from "lucide-react";
import type { WorkflowState } from "../../lib/store";

/* ──────────────── StatusPill ──────────────── */
const stateMap: Record<
  WorkflowState,
  { label: string; dot: string; pill: string }
> = {
  RUNNING: { label: "Running", dot: "bg-s-brand animate-pulse", pill: "bg-s-brand/10 text-s-brand border-s-brand/30" },
  COMPLETE: { label: "Complete", dot: "bg-s-success", pill: "bg-s-success/10 text-s-success border-s-success/30" },
  FAILED: { label: "Failed", dot: "bg-s-critical", pill: "bg-s-critical/10 text-s-critical border-s-critical/30" },
  PENDING: { label: "Pending", dot: "bg-s-muted", pill: "bg-s-subtle text-s-secondary border-s-border" },
  AWAITING_APPROVAL: { label: "Awaiting", dot: "bg-s-warning animate-pulse", pill: "bg-s-warning/10 text-s-warning border-s-warning/30" },
  BLOCKED: { label: "Blocked", dot: "bg-s-blocked", pill: "bg-s-blocked/10 text-s-blocked border-s-blocked/30" },
  CANCELLED: { label: "Cancelled", dot: "bg-s-muted", pill: "bg-s-subtle text-s-secondary border-s-border" },
};

export function StatusPill({ state }: { state: WorkflowState }) {
  const c = stateMap[state];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono border tracking-wider uppercase text-[10px] shrink-0 ${c.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  );
}

/* ──────────────── SeverityBadge ──────────────── */
export function SeverityBadge({ level }: { level: "P0" | "P1" | "P2" | "P3" | "HIGH" | "MEDIUM" | "LOW" | "CRITICAL" }) {
  const map: Record<string, string> = {
    P0: "bg-s-critical/15 text-s-critical border-s-critical/30",
    P1: "bg-s-warning/15 text-s-warning border-s-warning/30",
    P2: "bg-s-info/15 text-s-info border-s-info/30",
    P3: "bg-s-subtle text-s-secondary border-s-border",
    HIGH: "bg-s-critical/15 text-s-critical border-s-critical/30",
    CRITICAL: "bg-s-critical/15 text-s-critical border-s-critical/30",
    MEDIUM: "bg-s-warning/15 text-s-warning border-s-warning/30",
    LOW: "bg-s-info/15 text-s-info border-s-info/30",
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono border tracking-wider text-[10px] font-medium shrink-0 ${map[level]}`}>
      {level}
    </span>
  );
}

/* ──────────────── Card ──────────────── */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-s-surface border border-s-border rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.08)] ${className}`}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-s-border min-w-0 bg-s-surface/80">
      <div className="min-w-0">
        <div className="text-s-primary text-[13px] font-medium truncate">{title}</div>
        {subtitle && (
          <div className="text-s-secondary mt-0.5 text-[11px] truncate">{subtitle}</div>
        )}
      </div>
      {action && <div className="shrink-0 ml-2">{action}</div>}
    </div>
  );
}

/* ──────────────── Button ──────────────── */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  icon?: ReactNode;
}
export function Button({ variant = "secondary", size = "md", icon, children, className = "", ...rest }: BtnProps) {
  const sizing = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[13px]";
  const map: Record<Variant, string> = {
    primary: "bg-s-brand text-white hover:bg-s-brand-dim border border-transparent shadow-[0_1px_8px_var(--s-brand-glow)]",
    secondary: "bg-s-surface border border-s-border text-s-primary hover:border-s-border-strong hover:bg-s-hover",
    ghost: "border border-transparent text-s-secondary hover:bg-s-hover hover:text-s-primary",
    danger: "border border-s-critical/30 text-s-critical hover:bg-s-critical/10",
    success: "bg-s-success text-white hover:opacity-90 border border-transparent",
  };
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-md font-medium transition-colors shrink-0 disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${map[variant]} ${className}`}
      {...rest}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

/* ──────────────── EmptyState ──────────────── */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {icon && (
        <div className="w-10 h-10 rounded-md bg-s-subtle border border-s-border flex items-center justify-center text-s-muted mb-4">
          {icon}
        </div>
      )}
      <div className="text-s-primary mb-1 text-sm font-medium">{title}</div>
      {description && (
        <div className="text-s-secondary max-w-sm text-[12.5px] leading-relaxed">{description}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ──────────────── Modal ──────────────── */
export function Modal({
  open,
  onClose,
  title,
  children,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-s-elevated border border-s-border rounded-md shadow-2xl w-full" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-s-border">
          <span className="text-s-primary text-sm font-medium">{title}</span>
          <button onClick={onClose} className="text-s-muted hover:text-s-primary p-1 rounded">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ──────────────── RightPanel ──────────────── */
export function RightPanel({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-[480px] bg-s-elevated border-l border-s-border flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-s-border shrink-0 min-w-0">
          <span className="text-s-primary text-sm font-medium truncate">{title}</span>
          <button onClick={onClose} className="text-s-muted hover:text-s-primary p-1 rounded shrink-0 ml-2">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">{children}</div>
      </div>
    </div>
  );
}

/* ──────────────── KPI ──────────────── */
export function Kpi({
  label,
  value,
  delta,
  trend = "flat",
  hint,
}: {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
  hint?: string;
}) {
  const color = trend === "up" ? "text-s-success" : trend === "down" ? "text-s-critical" : "text-s-secondary";
  return (
    <Card className="p-4 overflow-hidden">
      <div className="label-mono mb-2">{label}</div>
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="font-mono text-s-primary text-2xl font-medium tabular-nums tracking-tight truncate">
          {value}
        </span>
        {delta && <span className={`font-mono text-[11px] shrink-0 ${color}`}>{delta}</span>}
      </div>
      {hint && <div className="text-s-muted mt-1 text-[11px] truncate">{hint}</div>}
    </Card>
  );
}

/* ──────────────── PageHeader ──────────────── */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-5 min-w-0 gap-4">
      <div className="min-w-0">
        <h1 className="text-s-primary text-xl font-medium tracking-tight truncate">{title}</h1>
        {description && (
          <div className="text-s-secondary mt-1 text-[13px] truncate">{description}</div>
        )}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}

/* ──────────────── Tabs ──────────────── */
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 border-b border-s-border overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`relative shrink-0 px-3 py-2.5 -mb-px border-b-2 transition-colors text-[13px] font-medium ${
            active === t.id
              ? "border-s-brand text-s-primary"
              : "border-transparent text-s-secondary hover:text-s-primary"
          }`}
        >
          {t.label}
          {typeof t.count === "number" && (
            <span className="ml-1.5 font-mono text-s-muted text-[11px]">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
