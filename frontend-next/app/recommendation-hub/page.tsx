"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DS } from "@/lib/ds";
import { Panel, PanelHeader, SectionLabel, LoadingSkeleton, ErrorBanner, EmptyState, Btn } from "@/components/ui";
import { Search, Send, MessageSquare, Mail, Phone, Copy, Check, Download, X, ChevronDown } from "lucide-react";

const TONES = [
  { key: "Professional",  emoji: "🎯", desc: "Formal, data-driven",        color: DS.primary },
  { key: "Friendly",      emoji: "😊", desc: "Warm and conversational",     color: DS.green },
  { key: "Urgent",        emoji: "⚡", desc: "Time-sensitive, direct",      color: DS.red },
  { key: "Consultative",  emoji: "🧠", desc: "Value-focused with insight",  color: "#8b5cf6" },
];

const ACTION_TYPES = ["up-sell", "cross-sell", "rescue", "retention", "affinity"];
const ACTION_CFG: Record<string, { color: string; bg: string; border: string }> = {
  "rescue":     { color: DS.red,     bg: "#FEF2F2", border: "#fca5a5" },
  "retention":  { color: DS.amber,   bg: "#FFFBEB", border: "#fcd34d" },
  "up-sell":    { color: DS.green,   bg: "#ECFDF5", border: "#6ee7b7" },
  "cross-sell": { color: DS.blue,    bg: "#EFF6FF", border: "#93c5fd" },
  "affinity":   { color: "#8b5cf6",  bg: "#F5F3FF", border: "#c4b5fd" },
};

const TONE_PROMPTS: Record<string, string> = {
  Professional: "formal, data-driven", Friendly: "warm and conversational",
  Urgent: "time-sensitive, direct", Consultative: "value-focused with insight",
};

const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp", icon: <MessageSquare size={13} />, color: "#25d366" },
  { key: "email",    label: "Email",    icon: <Mail size={13} />,           color: DS.primary },
  { key: "call",     label: "Call",     icon: <Phone size={13} />,          color: "#f59e0b" },
];

function fmt(v: unknown): string {
  const n = Number(v);
  if (!v && v !== 0) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toFixed(0)}`;
}

// ── Copy button ───────────────────────────────────────────────────────────
function CopyBtn({ text, style }: { text: string; style?: React.CSSProperties }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <button onClick={copy} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6, fontSize: 10.5, color: copied ? DS.green : DS.textMuted, transition: "all 0.15s", ...style }}>
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ── CSV export ─────────────────────────────────────────────────────────────
function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(","), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Partner autocomplete ──────────────────────────────────────────────────
function PartnerAutocomplete({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch states first, then partners list
  const { data: statesData } = useQuery({ queryKey: ["partner-states"], queryFn: api.partner.states });
  const firstState = ((statesData?.states ?? []) as string[])[0] ?? "";
  const { data: partnerListData } = useQuery({
    queryKey: ["partner-list-ac", firstState],
    queryFn: () => api.partner.list(firstState),
    enabled: !!firstState,
  });
  const allPartners = (partnerListData?.partners ?? []) as string[];

  useEffect(() => { setQuery(value); }, [value]);

  const filtered = query.length < 1
    ? allPartners.slice(0, 50)
    : allPartners.filter(p => p.toLowerCase().includes(query.toLowerCase())).slice(0, 50);

  useEffect(() => {
    function onOut(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", flex: 1 }}>
      <div style={{ position: "relative" }}>
        <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: DS.textMuted, pointerEvents: "none" }} />
        <input className="form-input" style={{ paddingLeft: 30, paddingRight: value ? 30 : undefined }}
          placeholder="Type partner name to search…" value={query}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); onChange(""); }}
        />
        {value && (
          <button onClick={() => { onChange(""); setQuery(""); }} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: DS.textMuted }}>
            <X size={12} />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 400,
          background: "#fff", borderRadius: 10, boxShadow: "0 8px 32px rgba(25,28,30,0.14)",
          border: "1px solid rgba(199,196,216,0.25)", maxHeight: 240, overflowY: "auto",
        }}>
          {filtered.map(p => (
            <div key={p}
              onClick={() => { onChange(p); setQuery(p); setOpen(false); }}
              style={{
                padding: "9px 14px", fontSize: 12.5, cursor: "pointer",
                background: p === value ? "#eef0ff" : "transparent",
                borderBottom: "1px solid rgba(199,196,216,0.08)",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => { if (p !== value) e.currentTarget.style.background = "#f7f9fb"; }}
              onMouseLeave={e => { if (p !== value) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontWeight: p === value ? 700 : 400, color: DS.text }}>{p}</span>
            </div>
          ))}
          {allPartners.length > 50 && (
            <p style={{ padding: "6px 14px", fontSize: 10, color: DS.textMuted, borderTop: "1px solid rgba(199,196,216,0.15)" }}>
              Showing 50 of {allPartners.length} — type to filter
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tone Card Selector ────────────────────────────────────────────────────
function ToneCardSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
      {TONES.map(t => {
        const active = value === t.key;
        return (
          <button key={t.key} onClick={() => onChange(t.key)}
            style={{
              border: `2px solid ${active ? t.color : "rgba(199,196,216,0.3)"}`,
              borderRadius: 10, padding: "10px 8px", textAlign: "center",
              background: active ? `${t.color}10` : "#fff",
              cursor: "pointer", transition: "all 0.15s",
              boxShadow: active ? `0 0 0 1px ${t.color}40` : "none",
            }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{t.emoji}</div>
            <p style={{ fontSize: 11, fontWeight: 800, color: active ? t.color : DS.text, margin: 0 }}>{t.key}</p>
            <p style={{ fontSize: 9.5, color: DS.textMuted, margin: "2px 0 0", lineHeight: 1.3 }}>{t.desc}</p>
          </button>
        );
      })}
    </div>
  );
}

// ── Script Panel (with copy + channel toggle) ─────────────────────────────
function ScriptPanel({ title, sub, whatsapp, email, call }: { title: string; sub?: string; whatsapp?: string; email?: string; call?: string }) {
  const [channel, setChannel] = useState<"whatsapp" | "email" | "call">("whatsapp");
  const text = channel === "whatsapp" ? whatsapp : channel === "email" ? email : call;
  const cfg = CHANNELS.find(c => c.key === channel)!;

  return (
    <Panel>
      <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid rgba(199,196,216,0.12)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 13, color: DS.text, margin: 0 }}>{title}</p>
            {sub && <p style={{ fontSize: 10.5, color: DS.textMuted, margin: "2px 0 0" }}>{sub}</p>}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {CHANNELS.map(c => (
              <button key={c.key} onClick={() => setChannel(c.key as "whatsapp" | "email" | "call")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "4px 10px", borderRadius: 8, fontSize: 10.5, fontWeight: channel === c.key ? 700 : 400,
                  border: `1.5px solid ${channel === c.key ? c.color : "rgba(199,196,216,0.35)"}`,
                  background: channel === c.key ? `${c.color}15` : "#fff",
                  color: channel === c.key ? c.color : DS.textMuted,
                  cursor: "pointer", transition: "all 0.12s",
                }}>
                {c.icon}{c.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ padding: "12px 18px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <CopyBtn text={text ?? ""} />
        </div>
        <div style={{ background: channel === "whatsapp" ? "#e9fce9" : "#f7f9fb", borderRadius: 10, padding: "12px 14px", borderLeft: `3px solid ${cfg.color}` }}>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "Inter, sans-serif", fontSize: 12.5, lineHeight: 1.8, color: DS.textMuted, margin: 0 }}>
            {text || `No ${channel} script for this tone.`}
          </pre>
        </div>
      </div>
    </Panel>
  );
}

export default function RecommendationHubPage() {
  const [partner, setPartner] = useState("");
  const [partnerInput, setPartnerInput] = useState("");
  const [nlQuery, setNLQuery] = useState("");
  const [stateScope, setStateScope] = useState("");
  const [tab, setTab] = useState<"Recommendations" | "Bundles" | "Pitch Script" | "Follow-Up" | "NL Query">("Recommendations");
  const [selectedFilter, setSelectedFilter] = useState<string[]>([]);
  const [pitchTone, setPitchTone] = useState("Professional");
  const [pitchSeq, setPitchSeq] = useState(0);
  const [fuDays, setFuDays] = useState(7);
  const [fuQty, setFuQty] = useState(1);
  const [fuTone, setFuTone] = useState("Friendly");
  const [nlResult, setNLResult] = useState<Record<string, unknown> | null>(null);
  const [nlLoading, setNLLoading] = useState(false);

  const { data: planData, isLoading: planLoading, error: planError, refetch: loadPlan } = useQuery({
    queryKey: ["rh-plan", partner],
    queryFn: () => api.recommendations.plan(partner, 5),
    enabled: false,
  });

  const { data: bundleData, isFetching: bundleLoading } = useQuery({
    queryKey: ["rh-bundles", partner],
    queryFn: () => api.recommendations.bundles(partner, 5),
    enabled: !!partner,
  });

  const { data: pitchData, isFetching: pitchLoading } = useQuery({
    queryKey: ["rh-pitch", partner, pitchSeq, pitchTone],
    queryFn: () => api.recommendations.pitchScript(partner, pitchSeq, pitchTone),
    enabled: !!partner,
  });

  const { data: fuData, isFetching: fuFetching } = useQuery({
    queryKey: ["rh-fu", partner, pitchSeq, fuDays, fuQty, fuTone],
    queryFn: () => api.recommendations.followup(partner, pitchSeq, fuDays, fuQty, fuTone),
    enabled: !!partner,
  });

  const recs = (planData?.recommendations as Record<string, unknown>[]) ?? [];
  const bundles = (bundleData?.rows ?? []) as Record<string, unknown>[];
  const filteredRecs = selectedFilter.length === 0 ? recs : recs.filter(r => selectedFilter.includes(String(r.action_type ?? "")));

  const handleNLQuery = async () => {
    if (!nlQuery.trim()) return;
    setNLLoading(true);
    try { const res = await api.recommendations.nlQuery(nlQuery, stateScope || undefined, 20); setNLResult(res); }
    catch { /* ignore */ }
    finally { setNLLoading(false); }
  };

  const nlRows = (nlResult?.results as Record<string, unknown>[]) ?? [];
  const nlSummary = String(nlResult?.summary ?? "");
  const nlFilters = (nlResult?.active_filters as Record<string, unknown>) ?? {};

  // Script generation  
  const genPitchScript = (rec: Record<string, unknown>, tone: string) => {
    const product = String(rec.product ?? rec.action ?? "a key product");
    const gain = Number(rec.expected_gain ?? rec.estimated_opportunity_value ?? 0);
    const toneStr = TONE_PROMPTS[tone] ?? "professional";
    return {
      subject: `[${tone}] Opportunity: ${product} — ${new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`,
      whatsapp: `Hi 👋 — we noticed *${product}* is a strong fit for your account. Partners like you are seeing ${fmt(gain)}/mo from it. Can we set up a quick call? 📞`,
      email: `Hi [Partner Name],\n\nI'm reaching out with a ${toneStr} perspective on an opportunity we've identified for you.\n\nBased on your account data, we believe adding *${product}* to your portfolio could generate approximately ${fmt(gain)} in additional monthly revenue.\n\nPartners in your segment who've made this move have seen consistent growth within 60 days.\n\nWould you be open to a 15-minute call this week to explore this?\n\nBest,\n[Your Name]`,
      call: `📞 CALL GUIDE — ${tone.toUpperCase()} TONE\n\n1. Open: "Hi [Partner Name], this is [Rep]. I'm calling about an opportunity around ${product}."\n2. Hook: "Partners with your profile are generating ${fmt(gain)}/month from it. Takes about 10 minutes to walk through."\n3. Ask: "Would 2pm or 4pm work for a quick call this week?"\n4. Close: "Great! I'll send the deck over WhatsApp now and follow up post-call."`,
    };
  };

  const genFollowup = (rec: Record<string, unknown>, days: number, qty: number, tone: string) => {
    const product = String(rec.product ?? rec.action ?? "the product");
    const toneStr = TONE_PROMPTS[tone] ?? "professional";
    return {
      whatsapp: `Hi 👋 — it's been ${days} days since we discussed *${product}*. A trial of ${qty}× units would let you test market response without any risk. When can we confirm this? 🔔`,
      email: `Subject: Following Up — ${product} Trial Opportunity\n\nHi [Partner Name],\n\nI'm following up in a ${toneStr} tone on our earlier conversation about ${product}.\n\nYou mentioned interest — and a trial of ${qty} units would be a low-risk way to validate demand with your end customers.\n\nMost partners make a decision within ${days} days of first contact. I'd love to lock in your allocation this week.\n\nLet me know if you'd like a call to finalise.\n\nWarm regards,\n[Your Name]`,
      call: `📞 FOLLOW-UP CALL GUIDE\n\n1. Remind: "Hi [Partner], calling back about the ${product} opportunity."\n2. Progress: "It's been ${days} days — any questions I can answer?"\n3. Trial: "I can get ${qty} units approved on a trial basis — no commitment."\n4. Push: "Can I confirm the order while I have you on the line?"`,
    };
  };

  const scriptRec = filteredRecs[pitchSeq] ?? recs[0];
  const pitchScript = scriptRec ? (pitchData?.whatsapp ? pitchData : genPitchScript(scriptRec, pitchTone)) : null;
  const fuScript    = scriptRec ? (fuData?.whatsapp    ? fuData    : genFollowup(scriptRec, fuDays, fuQty, fuTone)) : null;

  // Bulk export
  const handleBulkExport = () => {
    const rows = recs.map((r, i) => ({
      "#": i + 1,
      action: String(r.action ?? r.recommendation ?? ""),
      action_type: String(r.action_type ?? ""),
      product: String(r.product ?? ""),
      estimated_value: Number(r.estimated_opportunity_value ?? r.expected_gain ?? 0),
      context: String(r.context ?? ""),
      pitch_whatsapp: genPitchScript(r, pitchTone).whatsapp,
      pitch_email: genPitchScript(r, pitchTone).email,
    }));
    downloadCSV(rows, `${partner.replace(/\s/g, "_")}_recommendations.csv`);
  };

  return (
    <div style={{ animation: "fadeIn 0.25s ease-out" }}>
      <div className="page-hero" style={{ "--hero-accent": "#06b6d4" } as React.CSSProperties}>
        <span className="page-hero-icon">💡</span>
        <div>
          <div className="page-hero-title">Recommendation Hub</div>
          <div className="page-hero-sub">Collaborative filtering · Affinity mining · AI pitch scripts · Natural language queries</div>
        </div>
        {partner && recs.length > 0 && (
          <span style={{ marginLeft: "auto" }}>
            <Btn variant="outline" size="sm" onClick={handleBulkExport}><Download size={11} />Export All Recs CSV</Btn>
          </span>
        )}
      </div>

      {/* ── Partner autocomplete picker ─────────────────────────────────── */}
      <Panel style={{ marginBottom: 18 }}>
        <div style={{ padding: "14px 18px", display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 250 }}>
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.textMuted, marginBottom: 6 }}>Partner Name</p>
            <PartnerAutocomplete value={partnerInput} onChange={v => setPartnerInput(v)} />
          </div>
          <Btn variant="primary" onClick={() => { setPartner(partnerInput); loadPlan(); }}>Load Recommendations</Btn>
        </div>
      </Panel>

      {/* Tabs */}
      <div className="tab-list" style={{ marginBottom: 20 }}>
        {(["Recommendations", "Bundles", "Pitch Script", "Follow-Up", "NL Query"] as const).map(t => (
          <button key={t} className={`tab-item ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {/* === Recommendations Tab === */}
      {tab === "Recommendations" && (
        <>
          {/* ── Color-coded action filter chips */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: DS.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Filter:</span>
            {ACTION_TYPES.map(at => {
              const active = selectedFilter.includes(at);
              const cfg = ACTION_CFG[at] ?? { color: "#6366f1", bg: "#EEF2FF", border: "#a5b4fc" };
              return (
                <button key={at}
                  onClick={() => setSelectedFilter(prev => active ? prev.filter(x => x !== at) : [...prev, at])}
                  style={{
                    border: `1.5px solid ${active ? cfg.color : cfg.border}`,
                    borderRadius: 999, padding: "4px 12px", fontSize: 11.5, fontWeight: active ? 700 : 500,
                    background: active ? cfg.bg : "#fff", color: active ? cfg.color : DS.textMuted,
                    cursor: "pointer", transition: "all 0.12s", display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.color, display: "inline-block" }} />
                  {at}
                </button>
              );
            })}
            {selectedFilter.length > 0 && (
              <button onClick={() => setSelectedFilter([])} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, color: DS.textMuted, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                <X size={10} /> Clear
              </button>
            )}
          </div>

          {planLoading && <LoadingSkeleton lines={4} />}
          {planError && <ErrorBanner message="Could not load recommendations." />}

          {planData?.summary && (
            <div className="info-banner info-banner-blue" style={{ marginBottom: 14 }}>{String(planData.summary)}</div>
          )}

          {planData?.reasons && (
            <Panel style={{ marginBottom: 14 }}>
              <PanelHeader title="AI Model Signals" sub="Why these recommendations" />
              <div style={{ padding: "12px 16px" }}>
                {(planData.reasons as string[]).map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(199,196,216,0.1)", fontSize: 12.5, color: DS.textMuted }}>
                    <span style={{ color: DS.primary, fontWeight: 700 }}>›</span>{r}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <Panel>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px 8px", borderBottom: "1px solid rgba(199,196,216,0.12)" }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, color: DS.text, margin: 0 }}>Recommendations for {partner || "…"}</p>
                <p style={{ fontSize: 10.5, color: DS.textMuted, margin: "2px 0 0" }}>{filteredRecs.length} matching</p>
              </div>
              {recs.length > 0 && <Btn variant="ghost" size="sm" onClick={handleBulkExport}><Download size={10} />Export CSV</Btn>}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead><tr><th>#</th><th>Action</th><th>Type</th><th>Product</th><th>Est. Opportunity</th><th>Context</th><th>Use as Script</th></tr></thead>
                <tbody>
                  {filteredRecs.map((r, i) => {
                    const at = String(r.action_type ?? "");
                    const cfg = ACTION_CFG[at] ?? { color: "#6366f1", bg: "#EEF2FF", border: "#a5b4fc" };
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 800, color: DS.textMuted }}>{i + 1}</td>
                        <td style={{ fontWeight: 700, maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{String(r.action ?? r.recommendation ?? "")}</td>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, border: `1.5px solid ${cfg.border}`, borderRadius: 999, padding: "2px 8px", fontSize: 9.5, fontWeight: 700, background: cfg.bg, color: cfg.color }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color }} />{at}
                          </span>
                        </td>
                        <td style={{ color: DS.primary }}>{String(r.product ?? "—")}</td>
                        <td style={{ fontWeight: 700, color: DS.green }}>{fmt(r.estimated_opportunity_value ?? r.expected_gain)}</td>
                        <td style={{ fontSize: 11, color: DS.textMuted, maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{!!r.context && String(r.context)}</td>
                        <td><button className="btn btn-ghost" style={{ fontSize: 10, padding: "3px 7px" }} onClick={() => { setPitchSeq(i); setTab("Pitch Script"); }}>Use →</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredRecs.length === 0 && !planLoading && <EmptyState message="Enter a partner name and click Load Recommendations." />}
          </Panel>
        </>
      )}

      {/* === Bundles Tab === */}
      {tab === "Bundles" && (
        <>
          <SectionLabel>FP-Growth Predictive Bundles for {partner || "…"}</SectionLabel>
          {bundleLoading && <LoadingSkeleton lines={3} />}
          {bundles.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
              {bundles.map((b, i) => (
                <div key={i} className="bundle-card">
                  <p style={{ fontSize: 10, fontWeight: 700, color: DS.textMuted, marginBottom: 4, textTransform: "uppercase" }}>Trigger</p>
                  <p style={{ fontWeight: 700, fontSize: 11.5, marginBottom: 8 }}>{String(b.product_a ?? b.trigger ?? "")}</p>
                  <p style={{ fontSize: 10, fontWeight: 700, color: DS.primary, marginBottom: 2, textTransform: "uppercase" }}>Recommend</p>
                  <p style={{ fontWeight: 800, fontSize: 12.5, color: DS.primary }}>{String(b.product_b ?? b.recommended ?? "")}</p>
                  <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    <span className="badge badge-green" style={{ fontSize: 9.5 }}>Conf {(Number(b.confidence_a_to_b ?? b.confidence ?? 0) * 100).toFixed(0)}%</span>
                    <span className="badge badge-blue" style={{ fontSize: 9.5 }}>Lift {Number(b.lift_a_to_b ?? b.lift ?? 0).toFixed(1)}×</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No bundle data — enter a partner name and switch to Recommendations first." />
          )}
        </>
      )}

      {/* === Pitch Script Tab === */}
      {tab === "Pitch Script" && (
        <>
          <Panel style={{ marginBottom: 16 }}>
            <div style={{ padding: "16px 18px" }}>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.textMuted, marginBottom: 6 }}>Recommendation</p>
                <select className="form-select" value={pitchSeq} onChange={e => setPitchSeq(Number(e.target.value))}>
                  {recs.map((r, i) => <option key={i} value={i}>{i + 1}. {String(r.action ?? r.recommendation ?? `Rec ${i + 1}`)}</option>)}
                </select>
              </div>
              {/* ── Visual tone card selector */}
              <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.textMuted, marginBottom: 8 }}>Pitch Tone</p>
              <ToneCardSelector value={pitchTone} onChange={setPitchTone} />
            </div>
          </Panel>
          {pitchLoading && <LoadingSkeleton lines={3} />}
          {pitchScript ? (
            <ScriptPanel
              title="Pitch Script"
              sub={`${pitchTone} tone · ${String(scriptRec?.product ?? "")}`}
              whatsapp={String((pitchScript as Record<string, unknown>).whatsapp ?? "")}
              email={String((pitchScript as Record<string, unknown>).email ?? "")}
              call={String((pitchScript as Record<string, unknown>).call ?? genPitchScript(scriptRec!, pitchTone).call)}
            />
          ) : (
            <EmptyState message="Load recommendations first, then select one to generate a pitch script." />
          )}
        </>
      )}

      {/* === Follow-Up Tab === */}
      {tab === "Follow-Up" && (
        <>
          <Panel style={{ marginBottom: 16 }}>
            <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.textMuted, marginBottom: 6 }}>Days Since No Conversion</p>
                <input type="range" min={1} max={60} step={1} value={fuDays} onChange={e => setFuDays(Number(e.target.value))} />
                <p style={{ fontSize: 10, color: DS.textMuted, textAlign: "center", marginTop: 4 }}>{fuDays} days</p>
              </div>
              <div>
                <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.textMuted, marginBottom: 6 }}>Trial Quantity</p>
                <input type="range" min={1} max={20} step={1} value={fuQty} onChange={e => setFuQty(Number(e.target.value))} />
                <p style={{ fontSize: 10, color: DS.textMuted, textAlign: "center", marginTop: 4 }}>{fuQty} units</p>
              </div>
              <div>
                <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.textMuted, marginBottom: 6 }}>Recommendation</p>
                <select className="form-select" value={pitchSeq} onChange={e => setPitchSeq(Number(e.target.value))}>
                  {recs.map((r, i) => <option key={i} value={i}>{i + 1}. {String(r.action ?? `Rec ${i + 1}`)}</option>)}
                </select>
              </div>
              <div>
                <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.textMuted, marginBottom: 8 }}>Follow-Up Tone</p>
                <ToneCardSelector value={fuTone} onChange={setFuTone} />
              </div>
            </div>
          </Panel>
          {fuFetching && <LoadingSkeleton lines={3} />}
          {fuScript ? (
            <ScriptPanel
              title="Follow-Up Script"
              sub={`${fuDays}d since contact · Trial: ${fuQty} units · ${fuTone}`}
              whatsapp={String((fuScript as Record<string, unknown>).whatsapp ?? "")}
              email={String((fuScript as Record<string, unknown>).email ?? "")}
              call={String((fuScript as Record<string, unknown>).call ?? genFollowup(scriptRec!, fuDays, fuQty, fuTone).call)}
            />
          ) : (
            <EmptyState message="Load recommendations first, then generate follow-up scripts here." />
          )}
        </>
      )}

      {/* === NL Query Tab === */}
      {tab === "NL Query" && (
        <>
          <Panel style={{ marginBottom: 16 }}>
            <div style={{ padding: "16px 18px" }}>
              <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.textMuted, marginBottom: 8 }}>Natural Language Query</p>
              {/* Full-width textarea */}
              <textarea className="form-input" rows={4}
                style={{ width: "100%", resize: "vertical", fontFamily: "Inter, sans-serif", fontSize: 13, lineHeight: 1.7, padding: "12px 14px", boxSizing: "border-box" }}
                placeholder={'e.g. "Show top cross-sell opportunities for partners in Maharashtra with churn risk above 50%"\n\nor: "Rescue partners who haven\'t ordered in 90 days"\n\nor: "Up-sell candidates in Gujarat with revenue below ₹5L"'}
                value={nlQuery} onChange={e => setNLQuery(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleNLQuery(); }}
              />
              <div style={{ display: "flex", gap: 12, marginTop: 8, alignItems: "center" }}>
                <input className="form-input" style={{ maxWidth: 220, flex: 0 }} placeholder="State scope (optional)" value={stateScope} onChange={e => setStateScope(e.target.value)} />
                <button className="btn btn-primary" onClick={handleNLQuery} disabled={nlLoading} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Send size={12} />{nlLoading ? "Running…" : "Search"}
                </button>
                <span style={{ fontSize: 10.5, color: DS.textMuted }}>Ctrl+Enter to run</span>
              </div>
              <p style={{ fontSize: 11, color: DS.textMuted, marginTop: 8 }}>Examples: "rescue partners with churn &gt;60%" · "top up-sell opps in Gujarat" · "high credit risk partners needing action"</p>
            </div>
          </Panel>

          {nlLoading && <LoadingSkeleton lines={5} />}

          {nlResult && (
            <>
              {nlSummary && <div className="info-banner info-banner-blue" style={{ marginBottom: 14 }}>{nlSummary}</div>}
              {Object.keys(nlFilters).length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  <span style={{ fontSize: 10, color: DS.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Active filters:</span>
                  {Object.entries(nlFilters).map(([k, v]) => (
                    <span key={k} className="badge badge-indigo" style={{ fontSize: 10 }}>{k}: {String(v)}</span>
                  ))}
                </div>
              )}
              <Panel>
                <PanelHeader title="NL Query Results" sub={`${nlRows.length} matches`} />
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead><tr><th>Partner</th><th>Action</th><th>Type</th><th>Product</th><th>Est. Value</th><th>State</th></tr></thead>
                    <tbody>
                      {nlRows.map((r, i) => {
                        const at = String(r.action_type ?? "");
                        const cfg = ACTION_CFG[at] ?? { color: "#6366f1", bg: "#EEF2FF", border: "#a5b4fc" };
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 700 }}>{String(r.partner_name ?? r.partner ?? "")}</td>
                            <td style={{ maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{String(r.action ?? r.recommendation ?? "")}</td>
                            <td>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, border: `1.5px solid ${cfg.border}`, borderRadius: 999, padding: "2px 8px", fontSize: 9.5, fontWeight: 700, background: cfg.bg, color: cfg.color }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color }} />{at}
                              </span>
                            </td>
                            <td style={{ color: DS.primary }}>{String(r.product ?? "—")}</td>
                            <td style={{ fontWeight: 700, color: DS.green }}>{fmt(r.estimated_opportunity_value ?? r.expected_gain)}</td>
                            <td style={{ color: DS.textMuted }}>{String(r.state ?? "")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {nlRows.length === 0 && <EmptyState message="No results. Try rephrasing your natural language query." />}
              </Panel>
            </>
          )}
          {!nlResult && !nlLoading && <EmptyState message="Type a natural language question above and press Search or Ctrl+Enter." />}
        </>
      )}
    </div>
  );
}
