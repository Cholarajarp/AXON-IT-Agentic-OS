import { ExternalLink, BookOpen, Keyboard, Zap, MessageSquare } from "lucide-react";
import { RightPanel } from "./ui/primitives";
import { useWorkspaceSettings } from "../lib/queries";

const shortcuts = [
  { keys: ["⌘", "K"], label: "Open command palette" },
  { keys: ["⌘", "G"], label: "Submit new goal" },
  { keys: ["⌘", "B"], label: "Toggle sidebar" },
  { keys: ["⌘", "/"], label: "Focus search" },
  { keys: ["⌘", "⇧", "T"], label: "Toggle theme" },
  { keys: ["G", "C"], label: "Go to Command Center" },
  { keys: ["G", "W"], label: "Go to Workflows" },
  { keys: ["G", "A"], label: "Go to Agents" },
  { keys: ["?"], label: "Open help" },
  { keys: ["Esc"], label: "Close panels & dialogs" },
];

const guides = [
  { title: "Quickstart", desc: "Submit your first goal in under 2 minutes", icon: Zap },
  { title: "Architecture overview", desc: "How agents, memory, and policies fit together", icon: BookOpen },
  { title: "Approval workflows", desc: "Configure risk gates and blast-radius thresholds", icon: Zap },
  { title: "Production readiness", desc: "Check runtime gates, release evidence, and customer-safe launch status", icon: BookOpen },
  { title: "Evaluation lab", desc: "Gate prompts, tools, and model routes before production", icon: Zap },
];

export function HelpDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useWorkspaceSettings();
  const workspaceName = settings.data?.workspace.name?.trim() || "AXON Workspace";
  const tenantId = settings.data?.workspace.tenantId?.trim() || "tenant_default";

  return (
    <RightPanel open={open} onClose={onClose} title="Help & Docs">
      <div className="p-5 flex flex-col gap-5">
        <section>
          <div className="flex items-center gap-2 mb-2.5">
            <BookOpen size={14} className="text-s-brand" />
            <span className="text-s-primary" style={{ fontSize: "13px", fontWeight: 500 }}>Guides</span>
          </div>
          <div className="flex flex-col gap-1">
            {guides.map((g) => {
              const Icon = g.icon;
              return (
                <button
                  key={g.title}
                  className="flex items-start gap-3 px-2.5 py-2 rounded-md hover:bg-s-hover text-left"
                >
                  <Icon size={14} className="text-s-secondary mt-0.5" />
                  <div className="flex-1">
                    <div className="text-s-primary" style={{ fontSize: "12.5px", fontWeight: 500 }}>{g.title}</div>
                    <div className="text-s-secondary" style={{ fontSize: "11.5px" }}>{g.desc}</div>
                  </div>
                  <ExternalLink size={12} className="text-s-muted mt-1" />
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-2.5">
            <Keyboard size={14} className="text-s-brand" />
            <span className="text-s-primary" style={{ fontSize: "13px", fontWeight: 500 }}>Keyboard Shortcuts</span>
          </div>
          <div className="bg-s-base border border-s-border rounded-md divide-y divide-s-border">
            {shortcuts.map((s) => (
              <div key={s.label} className="flex items-center justify-between px-3 py-2">
                <span className="text-s-secondary" style={{ fontSize: "12.5px" }}>{s.label}</span>
                <div className="flex items-center gap-1">
                  {s.keys.map((k, i) => (
                    <kbd
                      key={i}
                      className="font-mono bg-s-subtle border border-s-border rounded px-1.5 py-0.5 text-s-secondary"
                      style={{ fontSize: "10px", minWidth: 18, textAlign: "center" }}
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-2.5">
            <MessageSquare size={14} className="text-s-brand" />
            <span className="text-s-primary" style={{ fontSize: "13px", fontWeight: 500 }}>Support</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a className="bg-s-base border border-s-border rounded-md px-3 py-3 hover:border-s-border-strong" style={{ fontSize: "12.5px" }}>
              <div className="text-s-primary" style={{ fontWeight: 500 }}>Status Page</div>
              <div className="text-s-muted font-mono mt-0.5" style={{ fontSize: "10px" }}>status.axon-it-agentic.ai</div>
            </a>
            <a className="bg-s-base border border-s-border rounded-md px-3 py-3 hover:border-s-border-strong" style={{ fontSize: "12.5px" }}>
              <div className="text-s-primary" style={{ fontWeight: 500 }}>Contact Support</div>
              <div className="text-s-muted font-mono mt-0.5" style={{ fontSize: "10px" }}>Settings - workspace owner</div>
            </a>
          </div>
        </section>

        <div className="border-t border-s-border pt-3 text-center text-s-muted font-mono" style={{ fontSize: "10px" }}>
          AXON IT Agentic AI OS · v1.0.0 · {workspaceName} · {tenantId}
        </div>
      </div>
    </RightPanel>
  );
}
