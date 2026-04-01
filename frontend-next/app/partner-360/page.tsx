"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DS } from "@/lib/ds";
import { Panel, PanelHeader, SectionLabel, LoadingSkeleton, ErrorBanner, EmptyState, Btn } from "@/components/ui";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from "recharts";
import {
  Download, TrendingDown, TrendingUp, AlertTriangle, CheckCircle,
  Copy, Check, ChevronDown, ChevronUp, BookOpen, Target, Zap, Search, X,
} from "lucide-react";

const TT = { background: "#fff", border: "1px solid rgba(199,196,216,0.3)", borderRadius: 10, fontSize: 11, boxShadow: "0 8px 24px rgba(25,28,30,0.08)" };

function fmt(v: unknown): string {
  const n = Number(v);
  if (!v && v !== 0) return "—";
  if (isNaN(n)) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toFixed(0)}`;
}

function churnColor(p: number) { return p < 0.35 ? DS.green : p < 0.65 ? DS.amber : DS.red; }

// ── Searchable partner autocomplete ──────────────────────────────────────────
function PartnerSearch({ partners, value, onChange }: { partners: string[]; value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const filtered = query.length < 1
    ? partners.slice(0, 60)
    : partners.filter(p => p.toLowerCase().includes(query.toLowerCase())).slice(0, 60);

  useEffect(() => {
    function onOutside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <Search size={13} style={{ position: "absolute", left: 10, color: DS.textMuted, pointerEvents: "none" }} />
        <input
          className="form-input"
          style={{ paddingLeft: 30, paddingRight: value ? 30 : undefined }}
          placeholder="Search partner name…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); onChange(""); }}
        />
        {value && (
          <button onClick={() => { onChange(""); setQuery(""); setOpen(false); }}
            style={{ position: "absolute", right: 8, background: "none", border: "none", cursor: "pointer", color: DS.textMuted }}>
            <X size={12} />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
          background: "#fff", borderRadius: 10, boxShadow: "0 8px 32px rgba(25,28,30,0.14)",
          border: "1px solid rgba(199,196,216,0.25)", maxHeight: 240, overflowY: "auto",
        }}>
          {filtered.map(p => (
            <div key={p}
              onClick={() => { onChange(p); setQuery(p); setOpen(false); }}
              style={{
                padding: "8px 14px", fontSize: 12.5, cursor: "pointer", color: DS.text,
                background: p === value ? "#eef0ff" : "transparent",
                fontWeight: p === value ? 700 : 400,
                transition: "background 0.1s",
              }}
              onMouseEnter={e => { if (p !== value) e.currentTarget.style.background = "#f7f9fb"; }}
              onMouseLeave={e => { if (p !== value) e.currentTarget.style.background = "transparent"; }}
            >
              {p}
            </div>
          ))}
          {partners.length > 60 && (
            <p style={{ padding: "6px 14px", fontSize: 10, color: DS.textMuted, borderTop: "1px solid rgba(199,196,216,0.2)" }}>
              Showing 60 of {partners.length} — type to filter
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Copy button with checkmark feedback ──────────────────────────────────────
function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <button onClick={copy}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700,
        padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
        background: copied ? "#ECFDF5" : "rgba(79,70,229,0.08)",
        color: copied ? DS.green : DS.primary, transition: "all 0.15s",
      }}
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {copied ? "Copied!" : label}
    </button>
  );
}

// ── Strip HTML tags for plain-text copy ──────────────────────────────────────
function stripHtml(html: string) { return html.replace(/<[^>]+>/g, ""); }

export default function Partner360Page() {
  const [state, setState] = useState("");
  const [partner, setPartner] = useState("");
  const [showLowGaps, setShowLowGaps] = useState(false);

  const { data: statesData } = useQuery({ queryKey: ["states"], queryFn: api.partner.states });
  const { data: partnersData } = useQuery({ queryKey: ["partners", state], queryFn: () => api.partner.list(state), enabled: !!state });
  const { data: report, isLoading, error } = useQuery({
    queryKey: ["partner360", partner], queryFn: () => api.partner.intelligence(partner), enabled: !!partner,
  });

  const facts = (report?.facts as Record<string, unknown>) ?? {};
  type GapRow = { Product: string; Potential_Revenue_Monthly: number; Potential_Revenue_Yearly: number; Potential_Revenue_Weekly?: number; Gap_Ratio_Pct: number; You_Do_Pct?: number; Others_Do_Pct?: number; Peer_Avg_Spend?: number; };
  const gaps = (report?.gaps as GapRow[]) ?? [];
  const clusterLabel = String(report?.cluster_label ?? "");
  const clusterType = String(report?.cluster_type ?? "");
  const clusterInfo = String(report?.cluster_info ?? "");
  const playbookRaw = (report?.playbook as Record<string, unknown>) ?? {};
  const history = (report?.monthly_revenue_history as Record<string, unknown>[]) ?? [];
  const alerts = (report?.alerts as Record<string, unknown>[]) ?? [];

  // Facts
  const churnProb = Number(facts.churn_probability ?? 0);
  const healthScore = Number(facts.health_score ?? 0);
  const creditScore = Number(facts.credit_risk_score ?? 0);
  const creditBand = String(facts.credit_risk_band ?? "");
  const creditUtil = Number(facts.credit_utilization ?? 0);
  const overdueRatio = Number(facts.overdue_ratio ?? 0);
  const outstandingAmt = Number(facts.outstanding_amount ?? 0);
  const creditAdjRisk = Number(facts.credit_adjusted_risk_value ?? 0);
  const drop = Number(facts.revenue_drop_pct ?? 0);
  const healthSeg = String(facts.health_segment ?? "");
  const estMonthlyLoss = Number(facts.estimated_monthly_loss ?? 0);
  const recencyDays = Number(facts.recency_days ?? 0);
  const risk90d = Number(facts.expected_revenue_at_risk_90d ?? 0);
  const riskMonthly = Number(facts.expected_revenue_at_risk_monthly ?? 0);
  const fc30d = Number(facts.forecast_next_30d ?? 0);
  const fcTrend = Number(facts.forecast_trend_pct ?? 0);
  const fcConf = Number(facts.forecast_confidence ?? 0);
  const degrowthFlag = Boolean(facts.degrowth_flag);
  const topPitch = String(facts.top_affinity_pitch ?? "");
  const pitchConf = Number(facts.pitch_confidence ?? 0);
  const pitchLift = Number(facts.pitch_lift ?? 0);
  const pitchGain = Number(facts.pitch_expected_gain ?? 0);
  const stateStr = String(facts.state ?? "your region");

  const missing = gaps[0] ? String(gaps[0].Product ?? "a key product") : "a key product category";
  const totalPotYearly = gaps.reduce((s, g) => s + Number(g.Potential_Revenue_Yearly ?? 0), 0);
  const totalPotMonthly = gaps.reduce((s, g) => s + Number(g.Potential_Revenue_Monthly ?? 0), 0) || totalPotYearly / 12;

  // Gap priority split
  const highGaps = gaps.filter(g => Number(g.Potential_Revenue_Monthly ?? 0) >= 50000);
  const medGaps  = gaps.filter(g => { const v = Number(g.Potential_Revenue_Monthly ?? 0); return v >= 10000 && v < 50000; });
  const lowGaps  = gaps.filter(g => Number(g.Potential_Revenue_Monthly ?? 0) < 10000);

  // ── Radar data: partner vs peers (using You_Do_Pct vs Others_Do_Pct) ──────
  // Take top 8 gaps for the radar to keep it readable
  const radarData = gaps.slice(0, 8).map(g => ({
    subject: String(g.Product).length > 18 ? String(g.Product).slice(0, 18) + "…" : String(g.Product),
    Partner: Number(g.You_Do_Pct ?? 0),
    Peers: Number(g.Others_Do_Pct ?? 0),
  }));

  // ── Playbook ──────────────────────────────────────────────────────────────
  const playbookTitle = String(playbookRaw.title ?? "Account Playbook");
  const playbookPriority = String(playbookRaw.priority ?? "Normal");
  const playbookNBA = String(playbookRaw.next_best_action ?? "");
  const playbookRationale = String(playbookRaw.rationale ?? "");
  const playbookActions = (playbookRaw.actions as string[]) ?? [];

  const playbookPriorityColor = playbookPriority === "Critical" ? DS.red : playbookPriority === "High" ? DS.amber : DS.green;
  const playbookPriorityBadge = playbookPriority === "Critical" ? "badge-red" : playbookPriority === "High" ? "badge-amber" : "badge-green";

  // ── SPIN script generator ─────────────────────────────────────────────────
  const recencyTxt = recencyDays > 30 ? `their last order was ${recencyDays} days ago` : "they've been ordering regularly";
  const spinS = `When you speak with them, open with what you already know — ${recencyTxt}, they're classified as a ${clusterType} account in the ${clusterLabel} segment. Ask: "You've been with us for a while — how's business holding up in ${stateStr} this quarter? Any pressure from customers on pricing or availability?"`;
  const spinP = drop > 5
    ? `Their orders have dropped ${drop.toFixed(1)}% in the last 90 days. Don't call it out bluntly — ask: "We noticed a shift in your order pattern. Have you been adjusting inventory levels, or is there something happening on the demand side with your end customers?"`
    : gaps.length > 0
      ? `Similar partners regularly stock ${missing}, but this partner hasn't picked it up. Try: "Your peers in the same region have been doing well with ${missing} — have you had a chance to test that with your customers?"`
      : `Things look stable, but probe for hidden friction: "Most distributors we speak with are managing tighter credit cycles and slower-moving stock. Is that affecting your cash flow?"`;
  const spinI = totalPotYearly > 10000
    ? `This isn't abstract — the numbers show a potential ${fmt(totalPotYearly)}/year left on the table. Land it like this: "If partners similar to you are generating an extra ${fmt(totalPotMonthly)}/month from ${missing}, and you're not in that space yet — over a year that's a real gap. What does that kind of revenue mean for your business?"`
    : churnProb > 0.5
      ? `Churn risk is elevated at ${(churnProb * 100).toFixed(0)}%. Make it tangible: "When partners slow down this much, we often see them consolidate suppliers — and the first ones cut are usually the ones they've had the least recent contact with. Is that a concern on your side?"`
      : `Keep it forward-looking: "Right now your numbers are solid, but the distributors who build the most resilience are the ones who diversify their product basket early — before demand forces them to. What categories are you looking to grow in the next two quarters?"`;
  const creditTxt = creditScore > 0.3 ? " We can also look at adjusting credit terms to free up working capital." : "";
  const spinN = `Close on a concrete action: "Let's set you up with a trial allocation of ${missing} for next month — no minimum commitment. If it moves, we lock in a priority schedule so you're never out of stock when your customers ask for it.${creditTxt} Does that work for you?"`;

  const spinItems = [
    { icon: "S", label: "Situation",   color: "#3b82f6", body: `<b>Situation</b> — ${spinS}` },
    { icon: "P", label: "Problem",     color: "#ef4444", body: `<b>Problem</b> — ${spinP}` },
    { icon: "I", label: "Implication", color: "#f59e0b", body: `<b>Implication</b> — ${spinI}` },
    { icon: "N", label: "Need-Payoff", color: "#10b981", body: `<b>Need-Payoff</b> — ${spinN}` },
  ];

  const fullSpinText = `SPIN Selling Script — ${partner}\n\n[S] Situation\n${spinS}\n\n[P] Problem\n${spinP}\n\n[I] Implication\n${spinI}\n\n[N] Need-Payoff\n${spinN}`;

  const partners = partnersData?.partners ?? [];

  if (error) return <ErrorBanner message="Could not load partner data." />;

  return (
    <div style={{ animation: "fadeIn 0.25s ease-out" }}>
      {/* Page hero */}
      <div className="page-hero" style={{ "--hero-accent": DS.blue } as React.CSSProperties}>
        <span className="page-hero-icon">🤝</span>
        <div>
          <div className="page-hero-title">Partner 360 View</div>
          <div className="page-hero-sub">Deep-dive into any partner — revenue health, churn risk, forecast, credit, and AI-powered selling scripts.</div>
        </div>
        <span style={{ marginLeft: "auto" }}>
          <Btn variant="outline" size="sm"><Download size={11} />Export</Btn>
        </span>
      </div>

      {/* Selectors */}
      <Panel style={{ marginBottom: 20 }}>
        <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
          <div>
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.textMuted, marginBottom: 6 }}>Step 1 — State / Region</p>
            <select className="form-select" value={state} onChange={e => { setState(e.target.value); setPartner(""); }}>
              <option value="">Select state…</option>
              {(statesData?.states ?? []).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.textMuted, marginBottom: 6 }}>
              Step 2 — Partner {partners.length > 0 && <span style={{ color: DS.primary, marginLeft: 6 }}>({partners.length} available)</span>}
            </p>
            {state ? (
              <PartnerSearch partners={partners} value={partner} onChange={setPartner} />
            ) : (
              <input className="form-input" disabled placeholder="Select a state first…" />
            )}
          </div>
        </div>
      </Panel>

      {!partner && <EmptyState message="Select a state then search for a partner to load their full 360 intelligence report." />}
      {isLoading && <LoadingSkeleton lines={6} />}

      {partner && !isLoading && report && (
        <>
          {/* ── Partner Hero Title ─────────────────────────────────────────── */}
          <div style={{
            background: "#fff", borderRadius: 16, padding: "20px 24px", marginBottom: 20,
            boxShadow: "0 2px 16px rgba(79,70,229,0.08)", borderLeft: `4px solid ${playbookPriorityColor}`,
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h1 style={{ fontFamily: "'Manrope', sans-serif", fontSize: "1.6rem", fontWeight: 800, color: DS.text, letterSpacing: "-0.025em", margin: 0 }}>
                  {partner}
                </h1>
                <span className={`badge ${playbookPriorityBadge}`} style={{ fontSize: 10.5 }}>
                  {playbookPriority} Priority
                </span>
                {degrowthFlag && <span className="badge badge-amber" style={{ fontSize: 10.5 }}><AlertTriangle size={9} /> Degrowth</span>}
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: DS.textMuted }}>📍 {stateStr}</span>
                <span style={{ fontSize: 12, color: DS.textMuted }}>•</span>
                <span style={{ fontSize: 12, color: DS.primary, fontWeight: 600 }}>{clusterType} Cluster</span>
                <span style={{ fontSize: 12, color: DS.textMuted }}>•</span>
                <span style={{ fontSize: 12, color: DS.textMuted }}>{clusterLabel}</span>
                {clusterInfo && clusterInfo !== "nan" && <>
                  <span style={{ fontSize: 12, color: DS.textMuted }}>•</span>
                  <span style={{ fontSize: 12, color: DS.textMuted }}>{clusterInfo}</span>
                </>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className={`badge ${healthSeg.includes("Champion") || healthSeg.includes("Healthy") ? "badge-green" : healthSeg.includes("At Risk") ? "badge-amber" : "badge-red"}`} style={{ fontSize: 11, padding: "4px 12px" }}>
                {healthSeg || String(facts.health_status ?? "Unknown")}
              </span>
              <span className={`badge ${churnProb < 0.35 ? "badge-green" : churnProb < 0.65 ? "badge-amber" : "badge-red"}`} style={{ fontSize: 11, padding: "4px 12px" }}>
                Churn {(churnProb * 100).toFixed(0)}%
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 999, background: recencyDays > 60 ? "#FEF2F2" : recencyDays > 30 ? "#FFFBEB" : "#ECFDF5", color: recencyDays > 60 ? DS.red : recencyDays > 30 ? DS.amber : DS.green }}>
                Last active {recencyDays}d ago
              </span>
            </div>
          </div>

          {/* Active alerts banner */}
          {alerts.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {alerts.map((a, i) => (
                <div key={i} className={`info-banner ${String(a.severity) === "critical" ? "info-banner-red" : "info-banner-amber"}`} style={{ marginBottom: 6 }}>
                  <AlertTriangle size={12} style={{ display: "inline", marginRight: 6 }} />
                  <strong>{String(a.title)}</strong>: {String(a.message)}
                </div>
              ))}
            </div>
          )}

          {/* KPIs 4-up */}
          <SectionLabel>Revenue Health</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
            <div className="metric-card">
              <p className="kpi-label">Revenue Drop (90d)</p>
              <p className="kpi-val" style={{ color: drop > 10 ? DS.red : drop > 5 ? DS.amber : DS.green }}>{drop.toFixed(1)}%</p>
              <span className={`kpi-delta ${drop > 5 ? "kpi-delta-down" : "kpi-delta-up"}`}>{drop > 5 ? <TrendingDown size={9} /> : <TrendingUp size={9} />}{drop > 5 ? "Declining" : "Stable"}</span>
            </div>
            <div className="metric-card">
              <p className="kpi-label">Upsell Potential (Yearly)</p>
              <p className="kpi-val" style={{ color: DS.primary }}>{fmt(totalPotYearly)}</p>
              <p className="kpi-sub">Monthly: {fmt(totalPotMonthly)} · {gaps.length} gaps</p>
            </div>
            <div className="metric-card">
              <p className="kpi-label">Health Score</p>
              <p className="kpi-val" style={{ color: healthScore > 0.6 ? DS.green : healthScore > 0.4 ? DS.amber : DS.red }}>{(healthScore * 100).toFixed(0)}%</p>
              <div className="gauge-track"><div className="gauge-fill" style={{ width: `${healthScore * 100}%`, background: healthScore > 0.6 ? DS.green : DS.amber }} /></div>
            </div>
            <div className="metric-card">
              <p className="kpi-label">Est. Monthly Loss</p>
              <p className="kpi-val" style={{ color: DS.red }}>{fmt(estMonthlyLoss)}</p>
              <p className="kpi-sub">90d at-risk: {fmt(risk90d)}</p>
            </div>
          </div>

          {/* Churn & Forecast */}
          <SectionLabel>Churn & Forecast</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
            <div className="metric-card">
              <p className="kpi-label">Churn Probability</p>
              <p className="kpi-val" style={{ color: churnColor(churnProb) }}>{(churnProb * 100).toFixed(1)}%</p>
              <p className="kpi-sub">{String(facts.churn_risk_band ?? "")}</p>
              <div className="gauge-track"><div className="gauge-fill" style={{ width: `${churnProb * 100}%`, background: churnColor(churnProb) }} /></div>
            </div>
            <div className="metric-card">
              <p className="kpi-label">Revenue At Risk (90d)</p>
              <p className="kpi-val" style={{ color: DS.red }}>{fmt(risk90d)}</p>
              <p className="kpi-sub">Monthly: {fmt(riskMonthly)}</p>
            </div>
            <div className="metric-card">
              <p className="kpi-label">Forecast Next 30d</p>
              <p className="kpi-val" style={{ color: fcTrend >= 0 ? DS.green : DS.amber }}>{fmt(fc30d)}</p>
              <span className={`kpi-delta ${fcTrend >= 0 ? "kpi-delta-up" : "kpi-delta-down"}`}>{fcTrend >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}{fcTrend > 0 ? "+" : ""}{fcTrend.toFixed(1)}%</span>
              <p className="kpi-sub" style={{ marginTop: 4 }}>Confidence: {fcConf.toFixed(2)}</p>
            </div>
            <div className="metric-card">
              <p className="kpi-label">Credit Risk</p>
              <p className="kpi-val" style={{ color: creditScore > 0.67 ? DS.red : creditScore > 0.33 ? DS.amber : DS.green }}>{(creditScore * 100).toFixed(1)}%</p>
              <p className="kpi-sub">Band: {creditBand} · Overdue {(overdueRatio * 100).toFixed(0)}%</p>
              <div className="gauge-track"><div className="gauge-fill" style={{ width: `${creditScore * 100}%`, background: creditScore > 0.67 ? DS.red : creditScore > 0.33 ? DS.amber : DS.green }} /></div>
            </div>
          </div>

          {/* Credit expanded */}
          <SectionLabel>Credit Details</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
            <div className="metric-card">
              <p className="kpi-label">Outstanding Amount</p>
              <p className="kpi-val">{fmt(outstandingAmt)}</p>
              <p className="kpi-sub">Adj Risk: {fmt(creditAdjRisk)}</p>
            </div>
            <div className="metric-card">
              <p className="kpi-label">Credit Utilization</p>
              <p className="kpi-val">{(creditUtil * 100).toFixed(1)}%</p>
              <div className="gauge-track"><div className="gauge-fill" style={{ width: `${creditUtil * 100}%`, background: creditUtil > 0.8 ? DS.red : DS.amber }} /></div>
            </div>
            <div className="metric-card">
              <p className="kpi-label">Overdue Ratio</p>
              <p className="kpi-val" style={{ color: overdueRatio > 0.3 ? DS.red : DS.green }}>{(overdueRatio * 100).toFixed(1)}%</p>
              <span className={`kpi-delta ${overdueRatio > 0.3 ? "kpi-delta-down" : "kpi-delta-up"}`}>{overdueRatio > 0.3 ? "High" : "Normal"}</span>
            </div>
            <div className="metric-card">
              <p className="kpi-label">Last Activity</p>
              <p className="kpi-val">{recencyDays}d</p>
              <p className="kpi-sub">days since last purchase</p>
            </div>
          </div>

          {/* Revenue History */}
          {history.length > 0 && (
            <>
              <SectionLabel>Monthly Revenue History</SectionLabel>
              <Panel style={{ marginBottom: 20 }}>
                <div style={{ padding: "8px 4px 16px" }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={history} margin={{ left: 55, right: 10, top: 8, bottom: 4 }}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={DS.primary} stopOpacity={0.15} />
                          <stop offset="100%" stopColor={DS.primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(199,196,216,0.2)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
                      <Tooltip contentStyle={TT} formatter={(v) => [fmt(v as number), "Revenue"]} />
                      <Area type="monotone" dataKey="revenue" stroke={DS.primary} strokeWidth={2.5} fill="url(#areaGrad)" dot={false} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </>
          )}

          {/* ── Peer Radar + Gap Analysis side-by-side ────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: radarData.length > 0 ? "1fr 1.6fr" : "1fr", gap: 16, marginBottom: 20 }}>

            {/* Radar chart */}
            {radarData.length > 0 && (
              <div>
                <SectionLabel>Product Mix vs Cluster Peers</SectionLabel>
                <Panel>
                  <PanelHeader title="Peer Comparison Radar" subtitle="Partner product basket vs cluster peer average (% of spend)" />
                  <div style={{ padding: "4px 8px 12px" }}>
                    <ResponsiveContainer width="100%" height={260}>
                      <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                        <PolarGrid stroke="rgba(199,196,216,0.3)" />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: DS.textMuted }} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 8 }} />
                        <Radar name="This Partner" dataKey="Partner" stroke={DS.primary} fill={DS.primary} fillOpacity={0.25} strokeWidth={2} />
                        <Radar name="Cluster Peers" dataKey="Peers" stroke={DS.green} fill={DS.green} fillOpacity={0.1} strokeWidth={2} strokeDasharray="4 2" />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                        <Tooltip contentStyle={TT} formatter={(v) => [`${Number(v ?? 0).toFixed(1)}%`, ""]} />
                      </RadarChart>
                    </ResponsiveContainer>
                    <p style={{ fontSize: 10, color: DS.textMuted, textAlign: "center", marginTop: 4 }}>
                      Gaps above peers = upsell opportunities · Solid line = partner, Dashed = peer average
                    </p>
                  </div>
                </Panel>
              </div>
            )}

            {/* Gap Analysis */}
            <div>
              <SectionLabel>Peer Gap Analysis — vs {clusterLabel} Peers</SectionLabel>
              {gaps.length === 0 ? (
                <div className="info-banner info-banner-green"><CheckCircle size={13} style={{ display: "inline", marginRight: 6 }} />Perfect account — matches peer average across all categories.</div>
              ) : (
                <>
                  <p style={{ fontSize: 11, fontWeight: 700, color: DS.primary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    {gaps.length} upsell opportunities · Est. {fmt(totalPotMonthly)}/month · {fmt(totalPotYearly)}/year
                  </p>

                  {/* High priority */}
                  {highGaps.length > 0 && (
                    <Panel style={{ marginBottom: 10 }}>
                      <div style={{ padding: "8px 12px 4px", borderBottom: "1px solid rgba(199,196,216,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span className="badge badge-red" style={{ fontSize: 9.5 }}>🔥 High Priority &gt;₹50K/mo — {highGaps.length}</span>
                      </div>
                      <div style={{ overflowX: "auto" }}><table className="data-table"><thead><tr><th>Product</th><th>Gap/Month</th><th>Gap/Year</th><th>You</th><th>Peers</th><th>Gap%</th></tr></thead><tbody>
                        {highGaps.map((g, i) => <tr key={i}>
                          <td style={{ fontWeight: 700 }}>{String(g.Product ?? "")}</td>
                          <td style={{ color: DS.red, fontWeight: 700 }}>{fmt(g.Potential_Revenue_Monthly)}</td>
                          <td>{fmt(g.Potential_Revenue_Yearly)}</td>
                          <td style={{ color: DS.textMuted }}>{Number(g.You_Do_Pct ?? 0).toFixed(1)}%</td>
                          <td style={{ color: DS.primary }}>{Number(g.Others_Do_Pct ?? 0).toFixed(1)}%</td>
                          <td><span style={{ fontSize: 10, background: "#FEF2F2", color: DS.red, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>{Number(g.Gap_Ratio_Pct ?? 0).toFixed(0)}%</span></td>
                        </tr>)}
                      </tbody></table></div>
                    </Panel>
                  )}

                  {/* Medium priority */}
                  {medGaps.length > 0 && (
                    <Panel style={{ marginBottom: 10 }}>
                      <div style={{ padding: "8px 12px 4px", borderBottom: "1px solid rgba(199,196,216,0.15)" }}>
                        <span className="badge badge-amber" style={{ fontSize: 9.5 }}>⚡ Medium Priority ₹10K–₹50K/mo — {medGaps.length}</span>
                      </div>
                      <div style={{ overflowX: "auto" }}><table className="data-table"><thead><tr><th>Product</th><th>Gap/Month</th><th>Gap/Year</th><th>You</th><th>Peers</th></tr></thead><tbody>
                        {medGaps.map((g, i) => <tr key={i}>
                          <td style={{ fontWeight: 700 }}>{String(g.Product ?? "")}</td>
                          <td style={{ color: DS.amber, fontWeight: 700 }}>{fmt(g.Potential_Revenue_Monthly)}</td>
                          <td>{fmt(g.Potential_Revenue_Yearly)}</td>
                          <td style={{ color: DS.textMuted }}>{Number(g.You_Do_Pct ?? 0).toFixed(1)}%</td>
                          <td style={{ color: DS.primary }}>{Number(g.Others_Do_Pct ?? 0).toFixed(1)}%</td>
                        </tr>)}
                      </tbody></table></div>
                    </Panel>
                  )}

                  {/* Low priority — collapsible */}
                  {lowGaps.length > 0 && (
                    <Panel style={{ marginBottom: 10 }}>
                      <button
                        onClick={() => setShowLowGaps(p => !p)}
                        style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                      >
                        <span className="badge badge-gray" style={{ fontSize: 9.5 }}>💡 Low Priority &lt;₹10K/mo — {lowGaps.length} items</span>
                        <span style={{ fontSize: 10, color: DS.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                          {showLowGaps ? "Collapse" : "Expand"} {showLowGaps ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </span>
                      </button>
                      {showLowGaps && (
                        <div style={{ overflowX: "auto" }}><table className="data-table"><thead><tr><th>Product</th><th>Gap/Month</th><th>Gap/Year</th><th>You</th><th>Peers</th></tr></thead><tbody>
                          {lowGaps.map((g, i) => <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{String(g.Product ?? "")}</td>
                            <td style={{ color: DS.textMuted }}>{fmt(g.Potential_Revenue_Monthly)}</td>
                            <td>{fmt(g.Potential_Revenue_Yearly)}</td>
                            <td style={{ color: DS.textMuted }}>{Number(g.You_Do_Pct ?? 0).toFixed(1)}%</td>
                            <td style={{ color: DS.primary }}>{Number(g.Others_Do_Pct ?? 0).toFixed(1)}%</td>
                          </tr>)}
                        </tbody></table></div>
                      )}
                    </Panel>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Playbook section ──────────────────────────────────────────── */}
          {playbookNBA && (
            <>
              <SectionLabel>
                <BookOpen size={11} style={{ marginRight: 4 }} />Account Playbook
              </SectionLabel>
              <Panel style={{ marginBottom: 20 }}>
                <div style={{ padding: "16px 20px" }}>
                  {/* NBA banner */}
                  <div style={{
                    background: `${playbookPriorityColor}10`,
                    border: `1px solid ${playbookPriorityColor}30`,
                    borderLeft: `4px solid ${playbookPriorityColor}`,
                    borderRadius: "0 8px 8px 0", padding: "12px 16px", marginBottom: 16,
                    display: "flex", alignItems: "flex-start", gap: 10,
                  }}>
                    <Target size={16} color={playbookPriorityColor} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, color: playbookPriorityColor, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                        Next Best Action · {playbookPriority} Priority
                      </p>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: DS.text, lineHeight: 1.5 }}>{playbookNBA}</p>
                    </div>
                  </div>

                  {/* Action items */}
                  {playbookActions.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                      {playbookActions.map((action, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: 6, background: DS.primary + "15",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, fontWeight: 800, color: DS.primary, flexShrink: 0,
                          }}>{i + 1}</div>
                          <p style={{ margin: 0, fontSize: 13, color: DS.text, lineHeight: 1.55, paddingTop: 2 }}>{action}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Rationale */}
                  {playbookRationale && (
                    <div style={{ padding: "8px 12px", background: "#f7f9fb", borderRadius: 8, marginBottom: 8 }}>
                      <p style={{ margin: 0, fontSize: 10.5, color: DS.textMuted, display: "flex", alignItems: "center", gap: 5 }}>
                        <Zap size={10} /> <strong>Rationale:</strong> {playbookRationale}
                      </p>
                    </div>
                  )}
                </div>
              </Panel>
            </>
          )}

          {/* Retention Pitch */}
          <SectionLabel>Retention Pitch Signal</SectionLabel>
          <Panel style={{ marginBottom: 20 }}>
            <div style={{ padding: "14px 16px" }}>
              {topPitch && topPitch !== "None" && topPitch !== "N/A" ? (
                <>
                  <div className="info-banner info-banner-blue" style={{ marginBottom: 10 }}>
                    <strong>Pitch This:</strong> {topPitch}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, color: DS.textMuted }}>
                    {pitchConf > 0 && <span>Confidence: <b>{pitchConf.toFixed(2)}</b></span>}
                    {pitchLift > 0 && <span>Lift: <b>{pitchLift.toFixed(2)}</b></span>}
                    {pitchGain > 0 && <span>Exp. Gain: <b>{fmt(pitchGain)}</b></span>}
                  </div>
                </>
              ) : (
                <div className="info-banner info-banner-green"><CheckCircle size={13} style={{ display: "inline", marginRight: 6 }} />No immediate missed attachment opportunities.</div>
              )}
              {degrowthFlag && <div className="info-banner info-banner-amber" style={{ marginTop: 10 }}><AlertTriangle size={11} style={{ display: "inline", marginRight: 6 }} />Degrowth detected in recent 90-day window.</div>}
            </div>
          </Panel>

          {/* ── SPIN Selling Script ───────────────────────────────────────── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <SectionLabel>SPIN Selling Script</SectionLabel>
            <CopyBtn text={fullSpinText} label="Copy Full Script" />
          </div>
          <div style={{ marginBottom: 8 }}>
            {spinItems.map(({ icon, label, color, body }) => {
              const plainText = stripHtml(body);
              return (
                <div key={label} className="spin-card">
                  <div className="spin-icon" style={{ background: color }}>{icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div className="spin-label" style={{ color }}>{label}</div>
                      <CopyBtn text={plainText} label="Copy" />
                    </div>
                    <div className="spin-body" dangerouslySetInnerHTML={{ __html: body.replace(`<b>${label}</b> — `, "") }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
