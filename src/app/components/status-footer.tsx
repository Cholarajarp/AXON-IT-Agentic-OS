import { Activity, Server, Shield, Clock, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { usePlatformHealth, useWorkspaceSettings } from "../lib/queries";

export function StatusFooter() {
  const [now, setNow] = useState(new Date());
  const health = usePlatformHealth();
  const settings = useWorkspaceSettings();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const apiStatus = health.isLoading ? 'checking' : health.isError ? 'disconnected' : health.data?.status === 'healthy' ? 'connected' : 'degraded';
  const tenantId = settings.data?.workspace.tenantId ?? 'tenant_default';
  const securityMode = settings.data?.runtime.auditSigningConfigured ? 'ledger signed' : 'ledger local';

  return (
    <footer className="h-7 shrink-0 border-t border-s-border bg-s-surface flex items-center px-4 gap-4 overflow-hidden">
      <div className="flex items-center gap-1.5 text-s-secondary text-[10.5px]">
        {apiStatus === 'connected' ? (
          <>
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-s-success opacity-50 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-s-success" />
            </span>
            <span className="font-mono uppercase tracking-wider">Operational</span>
          </>
        ) : apiStatus === 'degraded' ? (
          <>
            <Wifi size={11} className="text-s-warning shrink-0" />
            <span className="font-mono uppercase tracking-wider text-s-warning">Degraded</span>
          </>
        ) : apiStatus === 'disconnected' ? (
          <>
            <WifiOff size={11} className="text-s-warning shrink-0" />
            <span className="font-mono uppercase tracking-wider text-s-warning">Offline</span>
          </>
        ) : (
          <>
            <Wifi size={11} className="text-s-muted shrink-0 animate-pulse" />
            <span className="font-mono uppercase tracking-wider">Connecting</span>
          </>
        )}
      </div>

      <div className="hidden sm:flex items-center gap-1.5 text-s-secondary text-[10.5px]">
        <Activity size={11} className="shrink-0" />
        <span className="font-mono truncate max-w-[150px]">{tenantId}</span>
      </div>

      <div className="hidden md:flex items-center gap-1.5 text-s-secondary text-[10.5px]">
        <Server size={11} className="shrink-0" />
        <span className="font-mono">{health.data?.services.database === 'connected' ? 'db ready' : 'db not-ready'}</span>
      </div>

      <div className="hidden lg:flex items-center gap-1.5 text-s-secondary text-[10.5px]">
        <Shield size={11} className="text-s-success shrink-0" />
        <span className="font-mono">{securityMode}</span>
      </div>

      <div className="ml-auto flex items-center gap-3 text-s-muted text-[10.5px] shrink-0">
        <div className="flex items-center gap-1.5">
          <Clock size={11} className="shrink-0" />
          <span className="font-mono">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
        </div>
        <span className="font-mono hidden sm:inline">AXON IT Agentic AI OS v1.0.0</span>
      </div>
    </footer>
  );
}
