import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "warning" | "error" | "info";

interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastCtx {
  toast: (t: Omit<Toast, "id">) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

const iconMap: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
};

const colorMap: Record<ToastKind, string> = {
  success: "text-s-success border-s-success/30",
  warning: "text-s-warning border-s-warning/30",
  error: "text-s-critical border-s-critical/30",
  info: "text-s-info border-s-info/30",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastCtx["toast"]>((t) => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => [...prev, { ...t, id }]);
    setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 w-80">
        {items.map((t) => {
          const Icon = iconMap[t.kind];
          return (
            <div
              key={t.id}
              className={`bg-s-elevated border rounded-md shadow-2xl p-3 flex items-start gap-2.5 ${colorMap[t.kind]}`}
            >
              <Icon size={16} className="mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-s-primary" style={{ fontSize: "13px", fontWeight: 500 }}>{t.title}</div>
                {t.description && (
                  <div className="text-s-secondary mt-0.5" style={{ fontSize: "12px" }}>{t.description}</div>
                )}
              </div>
              <button onClick={() => dismiss(t.id)} className="text-s-muted hover:text-s-primary">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}

/* Keyboard shortcuts hook */
export function useHotkey(combo: string, fn: (e: KeyboardEvent) => void, deps: unknown[] = []) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName) && combo !== "Escape") return;
      const parts = combo.toLowerCase().split("+");
      const key = parts[parts.length - 1];
      const wantMeta = parts.includes("mod");
      const wantShift = parts.includes("shift");
      if (e.key.toLowerCase() === key && (!wantMeta || meta) && (!wantShift || e.shiftKey)) {
        e.preventDefault();
        fn(e);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, deps);
}
