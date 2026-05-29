import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queries';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';

export type WSEventType =
  | 'connected'
  | 'pong'
  | 'workflow.state'
  | 'task.state'
  | 'cost.record'
  | 'log'
  | 'approval.created'
  | 'approval.resolved'
  | 'incident.created'
  | 'incident.resolved'
  | 'alert.created'
  | string;

export interface WSEvent {
  type: WSEventType;
  payload: any;
  timestamp: number;
}

export function useWebSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected');
        reconnectAttemptsRef.current = 0;

        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000); // 30 seconds
      };

      ws.onmessage = (event) => {
        try {
          const data: WSEvent = JSON.parse(event.data);
          handleEvent(data);
        } catch (error) {
          console.error('[WS] Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected');
        cleanup();
        scheduleReconnect();
      };
    } catch (error) {
      console.error('[WS] Connection failed:', error);
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Exponential backoff with deterministic jitter to avoid synchronized reconnects.
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const attempt = reconnectAttemptsRef.current;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    const jitter = (attempt % 5) * 200;
    const delay = exponentialDelay + jitter;

    console.log(`[WS] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${attempt + 1})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++;
      connect();
    }, delay);
  };

  const cleanup = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = undefined;
    }
  };

  const handleEvent = (event: WSEvent) => {
    const type = event.type;
    if (type === 'connected' || type === 'pong') return;

    console.log('[WS] Event:', type, event.payload);

    switch (type) {
      case 'workflow.state':
      case 'task.state':
        queryClient.invalidateQueries({ queryKey: queryKeys.workflows });
        if (event.payload?.workflowId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.workflow(event.payload.workflowId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.dag(event.payload.workflowId) });
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.orchestratorStatus });
        break;

      case 'approval.created':
      case 'approval.resolved':
        queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
        queryClient.invalidateQueries({ queryKey: queryKeys.workflows });
        break;

      case 'incident.created':
      case 'incident.resolved':
        queryClient.invalidateQueries({ queryKey: queryKeys.incidents });
        break;

      case 'alert.created':
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
        break;

      case 'cost.record':
        queryClient.invalidateQueries({ queryKey: queryKeys.cost });
        queryClient.invalidateQueries({ queryKey: queryKeys.workflows });
        break;

      case 'log':
        break;

      case 'pipeline.executed':
        // Agent pipeline fired — refresh agents, audit, cost.
        queryClient.invalidateQueries({ queryKey: queryKeys.agents });
        queryClient.invalidateQueries({ queryKey: queryKeys.audit });
        queryClient.invalidateQueries({ queryKey: queryKeys.cost });
        if (event.payload?.workflowId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.workflow(event.payload.workflowId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.dag(event.payload.workflowId) });
        }
        break;

      case 'tool.executed':
        // Tool runtime fired — refresh tool stats and audit.
        queryClient.invalidateQueries({ queryKey: queryKeys.toolsStats });
        queryClient.invalidateQueries({ queryKey: queryKeys.audit });
        break;

      case 'audit.entry':
        queryClient.invalidateQueries({ queryKey: queryKeys.audit });
        break;

      default:
        // Handle backend events in colon format (workflow:created, etc.)
        if (type.includes(':')) {
          const [entity] = type.split(':');
          if (entity === 'workflow') queryClient.invalidateQueries({ queryKey: queryKeys.workflows });
          else if (entity === 'approval') queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
          else if (entity === 'incident') queryClient.invalidateQueries({ queryKey: queryKeys.incidents });
          else if (entity === 'alert') queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
        }
    }
  };

  useEffect(() => {
    connect();

    return () => {
      cleanup();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    reconnect: connect,
  };
}
