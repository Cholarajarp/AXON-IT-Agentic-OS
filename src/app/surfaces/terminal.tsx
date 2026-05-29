import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Filter, Pause, Play, RadioTower, RefreshCw, Terminal as TerminalIcon, Trash2 } from "lucide-react";
import { Button, Card, EmptyState, PageHeader } from "../components/ui/primitives";
import { createClientId } from "../lib/ids";

interface LogEntry {
  id: string;
  timestamp: number;
  level: "info" | "warn" | "error" | "debug" | "success";
  source: string;
  message: string;
}

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3001/ws";

const levelColors: Record<LogEntry["level"], string> = {
  info: "text-s-secondary",
  warn: "text-s-warning",
  error: "text-s-critical",
  debug: "text-s-muted",
  success: "text-s-success",
};

const levelLabels: Record<LogEntry["level"], string> = {
  info: "INF",
  warn: "WRN",
  error: "ERR",
  debug: "DBG",
  success: "OK ",
};

export function Terminal() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const logBufferRef = useRef<LogEntry[]>([]);

  const pushLog = (entry: Omit<LogEntry, "id" | "timestamp"> & { timestamp?: number }) => {
    const next = {
      ...entry,
      id: createClientId("log"),
      timestamp: entry.timestamp ?? Date.now(),
    };
    logBufferRef.current = [...logBufferRef.current.slice(-499), next];
    if (!paused) setLogs(logBufferRef.current);
  };

  const connect = () => {
    wsRef.current?.close();
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      pushLog({ level: "success", source: "WebSocket", message: `Connected to ${WS_URL}` });
      ws.send(JSON.stringify({ type: "ping" }));
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        pushLog({
          level: mapEventLevel(parsed.type),
          source: sourceFromType(parsed.type),
          message: formatEvent(parsed.type, parsed.payload),
          timestamp: parsed.timestamp,
        });
      } catch {
        pushLog({ level: "warn", source: "WebSocket", message: "Received non-JSON event from backend" });
      }
    };

    ws.onerror = () => {
      setConnected(false);
      pushLog({ level: "error", source: "WebSocket", message: "Connection error. Check backend status and VITE_WS_URL." });
    };

    ws.onclose = () => {
      setConnected(false);
      pushLog({ level: "warn", source: "WebSocket", message: "Disconnected from backend event stream" });
    };
  };

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!paused) setLogs(logBufferRef.current);
  }, [paused]);

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, paused]);

  const filteredLogs = useMemo(() => logs.filter((log) => {
    if (levelFilter !== "all" && log.level !== levelFilter) return false;
    if (filter && !`${log.message} ${log.source}`.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  }), [logs, levelFilter, filter]);

  const clearLogs = () => {
    logBufferRef.current = [];
    setLogs([]);
  };

  const exportLogs = () => {
    const text = filteredLogs.map((l) => `[${formatTime(l.timestamp)}] [${levelLabels[l.level]}] [${l.source}] ${l.message}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `axon-logs-${new Date().toISOString().slice(0, 19)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader title="Terminal" description="Live backend event stream from the agent fleet, scheduler, approvals, and cost ledger" />

      <Card>
        <div className="flex items-center justify-between px-4 py-2 border-b border-s-border gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <TerminalIcon size={14} className="text-s-brand shrink-0" />
            <span className="text-[12px] font-mono text-s-secondary shrink-0">{filteredLogs.length} entries</span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase ${connected ? "text-s-success" : "text-s-warning"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-s-success" : "bg-s-warning"}`} />
              {connected ? "live" : "offline"}
            </span>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="text-[11px] font-mono bg-s-subtle border border-s-border rounded px-1.5 py-0.5 text-s-secondary"
            >
              <option value="all">ALL</option>
              <option value="info">INFO</option>
              <option value="success">SUCCESS</option>
              <option value="warn">WARN</option>
              <option value="error">ERROR</option>
              <option value="debug">DEBUG</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative hidden sm:block">
              <Filter size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-s-muted" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter..."
                className="text-[11px] font-mono pl-6 pr-2 py-1 bg-s-subtle border border-s-border rounded w-[150px] text-s-primary placeholder:text-s-muted outline-none focus:border-s-brand/50"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPaused(!paused)}>
              {paused ? <Play size={12} /> : <Pause size={12} />}
            </Button>
            <Button variant="ghost" size="sm" onClick={connect}>
              <RefreshCw size={12} />
            </Button>
            <Button variant="ghost" size="sm" onClick={clearLogs}>
              <Trash2 size={12} />
            </Button>
            <Button variant="ghost" size="sm" onClick={exportLogs}>
              <Download size={12} />
            </Button>
          </div>
        </div>

        <div ref={scrollRef} className="h-[calc(100vh-280px)] overflow-y-auto overflow-x-hidden bg-s-base font-mono text-[11px] leading-[1.8]">
          {filteredLogs.length === 0 ? (
            <EmptyState
              icon={<RadioTower size={18} />}
              title="Waiting for backend events"
              description="Submit a workflow or trigger an approval to stream real execution telemetry here."
            />
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="flex items-start px-4 py-px hover:bg-s-hover/50 group">
                <span className="text-s-muted shrink-0 w-[72px]">{formatTime(log.timestamp)}</span>
                <span className={`shrink-0 w-[28px] ${levelColors[log.level]}`}>{levelLabels[log.level]}</span>
                <span className="shrink-0 w-[160px] text-s-secondary truncate">[{log.source}]</span>
                <span className={`flex-1 min-w-0 ${log.level === "error" ? "text-s-critical" : log.level === "warn" ? "text-s-warning" : "text-s-primary"}`}>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

function mapEventLevel(type?: string): LogEntry["level"] {
  if (!type) return "info";
  if (type.includes("failed") || type.includes("error")) return "error";
  if (type.includes("blocked") || type.includes("cancel") || type.includes("approval")) return "warn";
  if (type.includes("complete") || type.includes("resolved") || type === "connected" || type === "pong") return "success";
  if (type.includes("cost") || type.includes("runtime")) return "debug";
  return "info";
}

function sourceFromType(type?: string): string {
  if (!type) return "Backend";
  const [source] = type.split(/[.:]/);
  return source ? source.charAt(0).toUpperCase() + source.slice(1) : "Backend";
}

function formatEvent(type?: string, payload?: unknown): string {
  const summary = typeof payload === "object" && payload !== null
    ? Object.entries(payload as Record<string, unknown>)
      .slice(0, 5)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(" ")
    : String(payload ?? "");
  return `${type ?? "event"} ${summary}`.trim();
}
