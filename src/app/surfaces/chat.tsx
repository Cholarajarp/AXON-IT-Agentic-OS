import { useEffect, useRef, useState } from "react";
import { Send, Bot, User, Sparkles, RotateCcw, X } from "lucide-react";
import { Card, PageHeader, Button } from "../components/ui/primitives";
import { streamCompletion, type ModelInvokeRequest } from "../lib/queries";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  streaming?: boolean;
  meta?: { provider: string; model: string; cached: boolean };
  summary?: { tokensIn: number; tokensOut: number; cost: number; latencyMs: number };
  error?: string;
}

const STARTER_SUGGESTIONS = [
  "Deploy the payment service to staging with canary rollout",
  "Investigate why checkout latency spiked in the last hour",
  "Run a SOC 2 compliance audit on the auth module",
  "Build a feature to export audit logs as CSV",
  "What's the current system health status?",
];

const SYSTEM_PROMPT =
  "You are Axon, an enterprise AI operations orchestrator. Help the user by planning work, decomposing goals, or answering questions concisely.";

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "I'm Axon, your AI operations orchestrator. Ask me anything — your message is routed through the Model Router with policy enforcement, cost tracking, and audit logging.",
      timestamp: Date.now() - 5000,
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      abortRef.current?.();
    };
  }, []);

  const sendMessage = (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content,
      timestamp: Date.now(),
    };
    const assistantId = `msg_${Date.now() + 1}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: Date.now() + 1,
      streaming: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsStreaming(true);

    // Build the full history (excluding welcome) for context.
    const history: ModelInvokeRequest["messages"] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content },
    ];

    const abort = streamCompletion(
      {
        messages: history,
        taskType: "chat",
        maxTokens: 1024,
      },
      {
        onMeta: (meta) => {
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, meta } : m)));
        },
        onChunk: (delta) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m)),
          );
        },
        onDone: (summary) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, streaming: false, summary } : m)),
          );
          setIsStreaming(false);
          abortRef.current = null;
        },
        onError: (message) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, streaming: false, error: message, content: m.content || "(no response)" }
                : m,
            ),
          );
          setIsStreaming(false);
          abortRef.current = null;
        },
      },
    );
    abortRef.current = abort;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const stopStream = () => {
    abortRef.current?.();
    abortRef.current = null;
    setIsStreaming(false);
    setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
  };

  const clearChat = () => {
    abortRef.current?.();
    abortRef.current = null;
    setIsStreaming(false);
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Chat cleared. How can I help you?",
        timestamp: Date.now(),
      },
    ]);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Chat" description="Streaming completions routed through the backend Model Router" />

      <Card className="flex-1 flex flex-col min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {messages.length <= 1 && (
            <div className="pt-4">
              <div className="text-[11px] font-mono uppercase tracking-wider text-s-muted mb-2 flex items-center gap-1.5">
                <Sparkles size={11} /> Try asking
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STARTER_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left p-2.5 rounded-lg border border-s-border hover:bg-s-hover hover:border-s-border-strong transition-colors text-[12px] text-s-secondary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-s-border p-3">
          <div className="flex items-end gap-2">
            <Button variant="ghost" size="sm" onClick={clearChat} title="Clear chat" disabled={isStreaming}>
              <RotateCcw size={14} />
            </Button>
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your goal or ask a question..."
                rows={1}
                disabled={isStreaming}
                className="w-full px-3 py-2.5 rounded-lg bg-s-subtle border border-s-border text-[13px] text-s-primary placeholder:text-s-muted outline-none focus:border-s-brand/50 resize-none disabled:opacity-60"
              />
            </div>
            {isStreaming ? (
              <Button variant="danger" size="sm" onClick={stopStream} icon={<X size={14} />}>
                Stop
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => sendMessage()}
                disabled={!input.trim()}
              >
                <Send size={14} />
              </Button>
            )}
          </div>
          <div className="text-[10px] text-s-muted mt-1.5 px-9">
            Press Enter to send · Shift+Enter for new line · Stop aborts the SSE stream
          </div>
        </div>
      </Card>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
          isUser ? "bg-s-subtle" : "bg-s-brand/10"
        }`}
      >
        {isUser ? <User size={14} className="text-s-secondary" /> : <Bot size={14} className="text-s-brand" />}
      </div>
      <div className={`max-w-[75%] min-w-0 ${isUser ? "text-right" : ""}`}>
        {!isUser && message.meta && (
          <div className="text-[10px] font-mono text-s-muted mb-0.5 truncate">
            {message.meta.provider} · {message.meta.model}{message.meta.cached ? " · cached" : ""}
          </div>
        )}
        <div
          className={`inline-block px-3 py-2 rounded-lg text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? "bg-s-brand text-white rounded-br-sm"
              : "bg-s-surface border border-s-border text-s-primary rounded-bl-sm"
          }`}
        >
          {message.content}
          {message.streaming && <StreamingCursor />}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-s-muted">
          <span>{formatTime(message.timestamp)}</span>
          {message.summary && (
            <span className="font-mono">
              {message.summary.tokensIn}→{message.summary.tokensOut} tok · ${message.summary.cost.toFixed(5)} · {message.summary.latencyMs}ms
            </span>
          )}
          {message.error && <span className="text-s-critical font-mono truncate">error: {message.error}</span>}
        </div>
      </div>
    </div>
  );
}

function StreamingCursor() {
  return (
    <span className="inline-block ml-0.5 w-1.5 h-3.5 bg-s-brand align-middle" style={{ animation: "blink 1s step-start infinite" }}>
      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </span>
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
