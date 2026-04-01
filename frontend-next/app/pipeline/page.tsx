"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DS } from "@/lib/ds";
import { LoadingSkeleton, ErrorBanner } from "@/components/ui";
import { Search, SlidersHorizontal, ChevronDown, ChevronUp, AlertTriangle, User } from "lucide-react";

// ── Lane config must match backend keys exactly ──────────────────────────
const LANE_CONFIG = [
  { key: "champion",  label: "Champion",  emoji: "🏆", bg: "#ECFDF5", border: "#059669", tag: "#059669", tagBg: "#D1FAE5" },
  { key: "healthy",   label: "Healthy",   emoji: "✅", bg: "#EFF6FF", border: "#2563EB", tag: "#2563EB", tagBg: "#DBEAFE" },
  { key: "at_risk",   label: "At Risk",   emoji: "⚠️", bg: "#FFFBEB", border: "#D97706", tag: "#D97706", tagBg: "#FEF3C7" },
  { key: "critical",  label: "Critical",  emoji: "🚨", bg: "#FEF2F2", border: "#DC2626", tag: "#DC2626", tagBg: "#FEE2E2" },
];

function fmt(v: unknown): string {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || isNaN(n)) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

type PartnerCard = {
  company_name: string;
  state?: string;
  health_segment?: string;
  health_status?: string;
  churn_probability?: number;
  credit_risk_band?: string;
  recent_90_revenue?: number;
  revenue_drop_pct?: number;
};

export default function PipelinePage() {
  const [search, setSearch] = useState("");
  const [filterCredit, setFilterCredit] = useState("All");
  const [filterState, setFilterState] = useState("All");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["pipeline-kanban"],
    queryFn: api.pipeline.kanban,
    refetchInterval: 60000,
  });

  const lanes = (data?.lanes ?? []) as {
    key: string; label: string; count: number; partners: PartnerCard[];
  }[];

  // Collect all partners across all lanes
  const allPartners: PartnerCard[] = lanes.flatMap(l => l.partners ?? []);
  const allStates = Array.from(new Set(allPartners.map(p => p.state).filter(Boolean) as string[])).sort();

  // KPIs
  const totalPartners = allPartners.length;
  const totalRevenue90d = allPartners.reduce((s, p) => s + Number(p.recent_90_revenue ?? 0), 0);
  const highChurn = allPartners.filter(p => Number(p.churn_probability ?? 0) > 0.65).length;
  const criticalCredit = allPartners.filter(p => String(p.credit_risk_band ?? "").toLowerCase() === "high").length;

  // Filter per-lane
  function filterCards(cards: PartnerCard[]): PartnerCard[] {
    return cards.filter(c => {
      const name = String(c.company_name ?? "").toLowerCase();
      const matchSearch = !search || name.includes(search.toLowerCase());
      const matchCredit = filterCredit === "All" || String(c.credit_risk_band ?? "").toLowerCase() === filterCredit.toLowerCase();
      const matchState  = filterState  === "All" || c.state === filterState;
      return matchSearch && matchCredit && matchState;
    });
  }

  if (isLoading) return (
    <div style={{ animation: "fadeIn 0.2s" }}>
      <div className="page-hero" style={{ "--hero-accent": DS.amber } as React.CSSProperties}>
        <span className="page-hero-icon">📋</span>
        <div><div className="page-hero-title">Partner Pipeline</div><div className="page-hero-sub">Loading…</div></div>
      </div>
      <LoadingSkeleton lines={6} />
    </div>
  );
  if (error) return <ErrorBanner message="Could not load pipeline data. Ensure the backend is running." />;

  return (
    <div style={{ animation: "fadeIn 0.25s ease-out" }}>
      {/* Hero */}
      <div className="page-hero" style={{ "--hero-accent": DS.amber } as React.CSSProperties}>
        <span className="page-hero-icon">📋</span>
        <div>
          <div className="page-hero-title">Partner Pipeline</div>
          <div className="page-hero-sub">Health-segmented Kanban — Champion · Healthy · At Risk · Critical</div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Partners", value: totalPartners.toString(), color: DS.primary },
          { label: "90d Revenue", value: fmt(totalRevenue90d), color: DS.green },
          { label: "High Churn Risk", value: highChurn.toString(), color: DS.amber, sub: ">65% probability" },
          { label: "Critical Credit", value: criticalCredit.toString(), color: DS.red, sub: "High credit band" },
        ].map(k => (
          <div key={k.label} className="metric-card" style={{ padding: "16px 20px" }}>
            <p className="kpi-label">{k.label}</p>
            <p className="kpi-val" style={{ color: k.color }}>{k.value}</p>
            {k.sub && <p className="kpi-sub">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Search + filters — prominent */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: `${DS.shadow}, 0 0 0 1.5px rgba(79,70,229,0.1)`, padding: "14px 18px", marginBottom: 18 }}>
        <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.textMuted, marginBottom: 8 }}>Search Partners</p>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: DS.primary, pointerEvents: "none" }} />
            <input
              className="form-input"
              style={{ paddingLeft: 36, width: "100%", height: 40, fontSize: 13.5, borderColor: search ? DS.primary : undefined, boxShadow: search ? `0 0 0 3px ${DS.primary}20` : undefined }}
              placeholder='Partner name, company, state…'
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: DS.textMuted, display: "flex", alignItems: "center" }}>
                ✕
              </button>
            )}
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 11, gap: 5, height: 40, flexShrink: 0 }} onClick={() => setShowFilters(p => !p)}>
            <SlidersHorizontal size={12} />Filters {showFilters ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
          </button>
        </div>
        {search && (
          <p style={{ fontSize: 10.5, color: DS.textMuted, marginTop: 6 }}>
            Searching across {allPartners.length} partners — showing matches in all lanes
          </p>
        )}
        {showFilters && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(199,196,216,0.15)" }}>
            <div>
              <p className="filter-label">State</p>
              <select className="form-select" value={filterState} onChange={e => setFilterState(e.target.value)}>
                <option value="All">All states</option>
                {allStates.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <p className="filter-label">Credit Risk</p>
              <select className="form-select" value={filterCredit} onChange={e => setFilterCredit(e.target.value)}>
                <option value="All">All bands</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Kanban board */}
      {totalPartners === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", background: "#fff", borderRadius: 16, boxShadow: DS.shadow }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: DS.text, marginBottom: 6 }}>No pipeline data yet</p>
          <p style={{ fontSize: 12, color: DS.textMuted }}>Run clustering first — the pipeline is built from partner health segments computed by the ML engine.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
          {LANE_CONFIG.map(lc => {
            const lane = lanes.find(l => l.key === lc.key);
            const cards = filterCards(lane?.partners ?? []);
            const laneRevenue = cards.reduce((s, c) => s + Number(c.recent_90_revenue ?? 0), 0);

            // Churn heatmap bar
            const total = cards.length;
            const highC  = cards.filter(c => Number(c.churn_probability ?? 0) > 0.65).length;
            const medC   = cards.filter(c => { const ch = Number(c.churn_probability ?? 0); return ch > 0.35 && ch <= 0.65; }).length;
            const lowC   = total - highC - medC;
            const highPct = total > 0 ? (highC / total) * 100 : 0;

            return (
              <div key={lc.key} style={{ background: "#f9fafb", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(199,196,216,0.18)" }}>
                {/* Lane header */}
                <div style={{ background: lc.bg, borderTop: `3px solid ${lc.border}`, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 16 }}>{lc.emoji}</span>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: 12.5, color: lc.border }}>{lc.label}</p>
                    </div>
                    <span style={{ background: lc.tagBg, color: lc.tag, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>{cards.length}</span>
                  </div>
                  {laneRevenue > 0 && (
                    <p style={{ margin: "4px 0 0", fontSize: 10.5, color: lc.border, fontWeight: 600 }}>{fmt(laneRevenue)} 90-day revenue</p>
                  )}
                  {/* Mini churn heatmap bar */}
                  {total > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: lc.border, marginBottom: 3, opacity: 0.75 }}>
                        <span>Churn heatmap</span>
                        {highPct > 0 && <span style={{ color: "#DC2626", fontWeight: 700 }}>{highPct.toFixed(0)}% high-risk</span>}
                      </div>
                      <div style={{ display: "flex", height: 5, borderRadius: 999, overflow: "hidden", gap: 1 }}>
                        {lowC  > 0 && <div style={{ flex: lowC,  background: "#059669", opacity: 0.7 }} />}
                        {medC  > 0 && <div style={{ flex: medC,  background: "#B45309", opacity: 0.8 }} />}
                        {highC > 0 && <div style={{ flex: highC, background: "#DC2626" }} />}
                      </div>
                    </div>
                  )}
                </div>

                {/* Cards */}
                <div style={{ padding: "8px 8px", display: "flex", flexDirection: "column", gap: 8, maxHeight: "calc(100vh - 340px)", overflowY: "auto" }}>
                  {cards.length === 0 && (
                    <div style={{ padding: "20px 10px", textAlign: "center", fontSize: 11, color: DS.textMuted }}>— none —</div>
                  )}
                  {cards.map((card, i) => {
                    const churn = Number(card.churn_probability ?? 0);
                    const isHigh = churn > 0.65;
                    const isMed  = churn > 0.35;
                    const key = `${lc.key}-${i}`;
                    const isExpanded = expanded === key;
                    const drop = Number(card.revenue_drop_pct ?? 0);

                    return (
                      <div key={i}
                        onClick={() => setExpanded(isExpanded ? null : key)}
                        style={{
                          background: "#fff", borderRadius: 10, padding: "10px 12px",
                          boxShadow: "0 1px 4px rgba(25,28,30,0.06)", cursor: "pointer",
                          borderLeft: `3px solid ${lc.border}`,
                          transition: "box-shadow 0.15s, transform 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(25,28,30,0.1)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(25,28,30,0.06)"; e.currentTarget.style.transform = "none"; }}
                      >
                        {/* Card header */}
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: lc.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <User size={13} color={lc.border} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: DS.text, lineHeight: 1.3, wordBreak: "break-word" }}>
                              {card.company_name}
                              {isHigh && <AlertTriangle size={10} style={{ display: "inline", marginLeft: 4, color: DS.red }} />}
                            </p>
                            {card.state && <p style={{ margin: 0, fontSize: 10, color: DS.textMuted }}>{card.state}</p>}
                          </div>
                        </div>

                        {/* Metrics row */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: DS.green }}>{fmt(card.recent_90_revenue)}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                            background: isHigh ? "#FEE2E2" : isMed ? "#FEF3C7" : "#D1FAE5",
                            color: isHigh ? DS.red : isMed ? DS.amber : DS.green,
                          }}>
                            Churn {(churn * 100).toFixed(0)}%
                          </span>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(199,196,216,0.2)", fontSize: 11, display: "flex", flexDirection: "column", gap: 5 }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: DS.textMuted }}>Credit risk</span>
                              <span style={{ fontWeight: 700, color: card.credit_risk_band?.toLowerCase() === "high" ? DS.red : card.credit_risk_band?.toLowerCase() === "medium" ? DS.amber : DS.green }}>
                                {card.credit_risk_band || "—"}
                              </span>
                            </div>
                            {drop > 0 && (
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: DS.textMuted }}>Revenue drop</span>
                                <span style={{ fontWeight: 700, color: drop > 20 ? DS.red : DS.amber }}>{drop.toFixed(1)}%</span>
                              </div>
                            )}
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: DS.textMuted }}>Health</span>
                              <span style={{ fontWeight: 700, color: DS.text }}>{card.health_segment || card.health_status || "—"}</span>
                            </div>
                            {/* Churn gauge */}
                            <div style={{ marginTop: 4 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: DS.textMuted, marginBottom: 3 }}>
                                <span>Churn risk</span><span>{(churn*100).toFixed(1)}%</span>
                              </div>
                              <div style={{ height: 5, background: "#e6e8ea", borderRadius: 999, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${churn*100}%`, background: isHigh ? DS.red : isMed ? DS.amber : DS.green, borderRadius: 999, transition: "width 0.4s" }} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
