import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClientId } from "./ids";

export type WorkflowState =
  | "RUNNING"
  | "COMPLETE"
  | "FAILED"
  | "PENDING"
  | "AWAITING_APPROVAL"
  | "BLOCKED"
  | "CANCELLED";

export interface Workflow {
  id: string;
  name: string;
  goal: string;
  state: WorkflowState;
  step: string;
  agent: string;
  progress: number;
  startedAt: number;
  cost: number;
  budget: number;
  domain: string[];
}

export interface AgentInstance {
  id: string;
  type: string;
  version: string;
  state: "IDLE" | "RUNNING" | "ERROR";
  currentTask?: string;
  tokensUsed: number;
  confidence: number;
  completion: number;
  updatedAt: number;
}

export interface Approval {
  id: string;
  title: string;
  workflowId: string;
  agentId: string;
  riskScore: number;
  blastRadius: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reversible: boolean;
  expiresAt: number;
  severity: "HIGH" | "MEDIUM" | "LOW";
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export interface Alert {
  id: string;
  severity: "P0" | "P1" | "P2" | "P3";
  title: string;
  source: string;
  createdAt: number;
}

export interface Incident {
  id: string;
  severity: "P0" | "P1" | "P2" | "P3";
  title: string;
  affected: string[];
  state: "ACTIVE" | "REMEDIATING" | "RESOLVED" | "POST_MORTEM";
  startedAt: number;
  resolvedAt?: number;
}

export interface Policy {
  id: string;
  name: string;
  type: "Tool" | "Data" | "Approval" | "Model" | "Cost" | "Environment";
  scope: string;
  version: string;
  status: "ACTIVE" | "DRAFT" | "DEPRECATED";
  updatedAt: number;
  violations7d: number;
}

export interface Evidence {
  id: string;
  controlId: string;
  framework: string;
  description: string;
  status: "SATISFIED" | "PARTIAL" | "MISSING";
  workflowId?: string;
  agentId?: string;
  generatedAt: number;
}

interface AppState {
  workflows: Workflow[];
  agents: AgentInstance[];
  approvals: Approval[];
  alerts: Alert[];
  incidents: Incident[];
  policies: Policy[];
  evidence: Evidence[];
}

interface StoreContextValue extends AppState {
  submitGoal: (input: { name: string; goal: string; domain: string }) => void;
  resolveApproval: (id: string, decision: "APPROVED" | "REJECTED") => void;
  killWorkflow: (id: string) => void;
  acknowledgeAlert: (id: string) => void;
  resolveIncident: (id: string) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const initialState: AppState = {
  workflows: [],
  agents: [],
  approvals: [],
  alerts: [],
  incidents: [],
  policies: [],
  evidence: [],
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);

  const value = useMemo<StoreContextValue>(
    () => ({
      ...state,
      submitGoal: ({ name, goal, domain }) => {
        const id = createClientId("wf");
        const wf: Workflow = {
          id,
          name,
          goal,
          state: "PENDING",
          step: "Planner agent decomposing goal",
          agent: "PlannerAgent",
          progress: 0,
          startedAt: Date.now(),
          cost: 0,
          budget: 1000,
          domain: [domain],
        };
        setState((s) => ({ ...s, workflows: [wf, ...s.workflows] }));
      },
      resolveApproval: (id, decision) =>
        setState((s) => ({
          ...s,
          approvals: s.approvals.map((a) => (a.id === id ? { ...a, status: decision } : a)),
        })),
      killWorkflow: (id) =>
        setState((s) => ({
          ...s,
          workflows: s.workflows.map((w) => (w.id === id ? { ...w, state: "CANCELLED" } : w)),
        })),
      acknowledgeAlert: (id) =>
        setState((s) => ({ ...s, alerts: s.alerts.filter((a) => a.id !== id) })),
      resolveIncident: (id) =>
        setState((s) => ({
          ...s,
          incidents: s.incidents.map((i) =>
            i.id === id ? { ...i, state: "RESOLVED", resolvedAt: Date.now() } : i,
          ),
        })),
    }),
    [state],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

/* Theme */
type Theme = "light" | "dark";
const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/* Router (state-based) */
export type Route =
  | "command"
  | "workflows"
  | "agents"
  | "memory"
  | "policies"
  | "evidence"
  | "incidents"
  | "cost"
  | "executive"
  | "settings";

const RouteContext = createContext<{ route: Route; setRoute: (r: Route) => void } | null>(null);

export function RouteProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>("command");
  return <RouteContext.Provider value={{ route, setRoute }}>{children}</RouteContext.Provider>;
}

export function useRoute() {
  const ctx = useContext(RouteContext);
  if (!ctx) throw new Error("useRoute must be used within RouteProvider");
  return ctx;
}
