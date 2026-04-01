"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { DS } from "@/lib/ds";
import { Send, Bot, User, Sparkles, RotateCcw, Lightbulb } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  ts: number;
};

const QUICK_QUESTIONS = [
  "What is the projected revenue for our top partners?",
  "Who are the top performing sales reps?",
  "Show me all dead stock items",
  "Which products are growing and which are declining?",
  "Which partners have the highest churn risk?",
  "Show me the top cross-sell bundle opportunities",
  "Who are our top partners by lifetime revenue?",
  "What products are approaching end of life?",
];

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code style="background:#f0f0ff;padding:1px 5px;border-radius:4px;font-size:0.9em;font-family:monospace">$1</code>')
    .replace(/^(#{1,3}) (.+)$/gm, '<p style="font-weight:800;font-size:13px;margin:8px 0 4px">$2</p>')
    .replace(/^[-•] (.+)$/gm, '<li style="margin:3px 0;padding-left:4px">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="margin:6px 0;padding-left:16px">$&</ul>')
    .replace(/\n{2,}/g, '</p><p style="margin:6px 0">')
    .replace(/\n/g, "<br/>");
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your **Consistent AI Business Intelligence Assistant**. I have live access to data from all 9 modules — Partner 360, Clusters, Market Basket, Inventory, Product Lifecycle, Sales Rep, Recommendations, Pipeline, and Monitoring.\n\nAsk me anything about your business.",
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [botState, setBotState] = useState<"idle" | "thinking" | "answering">("idle");
  const [showQuick, setShowQuick] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea
  const growTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxH = parseInt(getComputedStyle(el).lineHeight || "22", 10) * 5 + 22;
    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
  }, []);

  useEffect(() => { growTextarea(); }, [input, growTextarea]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;

    setShowQuick(false);
    setInput("");
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }
    const userMsg: Message = { role: "user", content: q, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setBotState("thinking");

    // Build history for API
    const history = messages
      .filter(m => m.role !== "assistant" || m !== messages[0]) // skip greeting
      .map(m => ({ role: m.role, content: m.content }));

    try {
      // After 1.5s simulate answering state
      const thinkTimer = setTimeout(() => setBotState("answering"), 1500);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/chat/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, history }),
        cache: "no-store",
      });
      clearTimeout(thinkTimer);
      const data = await res.json() as { answer?: string; status?: string };
      const answer = data.answer ?? "Sorry, I couldn't process that. Please try again.";
      setBotState("answering");
      setMessages(prev => [...prev, { role: "assistant", content: answer, ts: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "\u26a0\ufe0f Could not reach the backend. Is the FastAPI server running?", ts: Date.now() }]);
    } finally {
      setLoading(false);
      setBotState("idle");
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const clearChat = () => {
    setMessages([{
      role: "assistant",
      content: "Chat cleared. Ready for your next question!",
      ts: Date.now(),
    }]);
    setShowQuick(true);
    setInput("");
    setBotState("idle");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 48px)", animation: "fadeIn 0.2s ease-out" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 0 14px", borderBottom: "1px solid rgba(199,196,216,0.15)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg, #3525cd, #4F46E5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(79,70,229,0.3)" }}>
            <Bot size={20} color="#fff" />
          </div>
          <div>
            <p style={{ margin: 0, fontFamily: "Manrope", fontWeight: 800, fontSize: 15, color: DS.text }}>AI Business Intelligence</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
              <p style={{ margin: 0, fontSize: 11, color: DS.textMuted }}>Live — GPT-4o · All 9 modules loaded</p>
            </div>
          </div>
        </div>
        <button
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: DS.textMuted, background: "none", border: "1px solid rgba(199,196,216,0.3)", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}
          onClick={clearChat}
        >
          <RotateCcw size={11} /> Clear chat
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 2px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Capability chips */}
        {showQuick && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {["Partner 360", "Churn Risk", "Clusters", "Sales Reps", "Inventory", "Product Lifecycle", "Market Basket", "Pipeline"].map(cap => (
              <span key={cap} style={{ fontSize: 10.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: "#e2dfff", color: DS.primary, letterSpacing: "0.04em" }}>
                <Sparkles size={9} style={{ display: "inline", marginRight: 3 }} />{cap}
              </span>
            ))}
          </div>
        )}

        {messages.map((msg, i) => {
          const isAI = msg.role === "assistant";
          return (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", flexDirection: isAI ? "row" : "row-reverse", animation: "slideUp 0.18s ease-out" }}>
              {/* Avatar */}
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                background: isAI ? "linear-gradient(135deg, #3525cd, #4F46E5)" : DS.primary + "20",
                boxShadow: isAI ? "0 2px 8px rgba(79,70,229,0.25)" : "none",
              }}>
                {isAI ? <Bot size={16} color="#fff" /> : <User size={16} color={DS.primary} />}
              </div>

              {/* Bubble */}
              <div style={{
                maxWidth: "76%", flex: 1,
                background: isAI ? "#fff" : "linear-gradient(135deg, #3525cd, #4F46E5)",
                color: isAI ? DS.text : "#fff",
                borderRadius: isAI ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
                padding: "12px 16px",
                boxShadow: isAI ? "0 2px 12px rgba(25,28,30,0.06)" : "0 4px 16px rgba(79,70,229,0.25)",
                fontSize: 13.5, lineHeight: 1.7,
              }}>
                {isAI ? (
                  <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                ) : (
                  <p style={{ margin: 0 }}>{msg.content}</p>
                )}
                <p style={{ margin: "8px 0 0", fontSize: 9.5, opacity: 0.5, textAlign: "right" }}>{formatTime(msg.ts)}</p>
              </div>
            </div>
          );
        })}

        {/* Typing indicator - distinct thinking vs answering */}
        {loading && (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            {/* THINKING avatar: amber pulsing ring */}
            {botState === "thinking" ? (
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "linear-gradient(135deg, #B45309, #f59e0b)",
                boxShadow: "0 0 0 3px #f59e0b40",
                animation: "spin 1.5s linear infinite",
              }}>
                <Bot size={16} color="#fff" />
              </div>
            ) : (
              /* ANSWERING avatar: indigo with a green dot */
              <div style={{ position: "relative" }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "linear-gradient(135deg, #3525cd, #4F46E5)",
                  boxShadow: "0 0 0 3px rgba(79,70,229,0.3)",
                }}>
                  <Bot size={16} color="#fff" />
                </div>
                <span style={{ position: "absolute", bottom: -2, right: -2, width: 10, height: 10, borderRadius: "50%", background: DS.green, border: "2px solid #fff", boxShadow: `0 0 6px ${DS.green}` }} />
              </div>
            )}
            <div style={{ background: "#fff", borderRadius: "4px 14px 14px 14px", padding: "14px 18px", boxShadow: "0 2px 12px rgba(25,28,30,0.06)" }}>
              <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, color: botState === "thinking" ? DS.amber : DS.green, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {botState === "thinking" ? "⏳ Thinking…" : "✍️ Writing answer…"}
              </p>
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                {[0, 1, 2].map(j => (
                  <div key={j} style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: botState === "thinking" ? DS.amber : DS.primary,
                    animation: `bounce 1.2s ${j * 0.2}s ease-in-out infinite`,
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick questions */}
      {showQuick && (
        <div style={{ padding: "0 0 12px", flexShrink: 0 }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.textMuted, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Lightbulb size={11} /> Quick questions
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {QUICK_QUESTIONS.map((q, i) => (
              <button key={i} onClick={() => send(q)}
                style={{
                  fontSize: 11.5, padding: "7px 14px", borderRadius: 20, cursor: "pointer", fontWeight: 600,
                  background: "rgba(79,70,229,0.07)", color: DS.primary, border: "1px solid rgba(79,70,229,0.2)",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(79,70,229,0.14)"; e.currentTarget.style.borderColor = "rgba(79,70,229,0.4)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(79,70,229,0.07)"; e.currentTarget.style.borderColor = "rgba(79,70,229,0.2)"; }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input — auto-growing textarea */}
      <div style={{ borderTop: "1px solid rgba(199,196,216,0.15)", paddingTop: 16, flexShrink: 0, marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", background: "#fff", borderRadius: 14, padding: "8px 8px 8px 16px", boxShadow: "0 2px 16px rgba(79,70,229,0.08), 0 0 0 2px rgba(79,70,229,0.08)" }}>
          <textarea
            ref={textareaRef}
            value={input}
            rows={1}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask anything about your partners, products, clusters, revenue…"
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              fontSize: 13.5, color: DS.text, fontFamily: "Inter, sans-serif",
              resize: "none", lineHeight: 1.6, overflow: "hidden",
              padding: "4px 0", minHeight: 28,
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            style={{
              width: 38, height: 38, borderRadius: 10, border: "none", cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              background: loading || !input.trim() ? "#e6e8ea" : "linear-gradient(135deg, #3525cd, #4F46E5)",
              color: loading || !input.trim() ? "#9ca3af" : "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s", boxShadow: loading || !input.trim() ? "none" : "0 2px 8px rgba(79,70,229,0.3)",
              flexShrink: 0,
            }}
          >
            <Send size={15} />
          </button>
        </div>
        <p style={{ fontSize: 10.5, color: DS.textMuted, textAlign: "center", marginTop: 8 }}>
          Powered by GPT-4o · Context: all modules pre-loaded · Press <kbd style={{ fontSize: 10, background: "#f0f0f0", padding: "1px 5px", borderRadius: 4, border: "1px solid #ddd" }}>Enter</kbd> to send · <kbd style={{ fontSize: 10, background: "#f0f0f0", padding: "1px 5px", borderRadius: 4, border: "1px solid #ddd" }}>Shift+Enter</kbd> for newline
        </p>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
