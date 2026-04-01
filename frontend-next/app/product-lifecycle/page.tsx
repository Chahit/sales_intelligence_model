"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DS } from "@/lib/ds";
import { Panel, PanelHeader, SectionLabel, LoadingSkeleton, ErrorBanner, EmptyState, Btn } from "@/components/ui";
import {
  AreaChart, Area, BarChart, Bar, ScatterChart, Scatter, PieChart, Pie, Cell,
  XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Flame, Download } from "lucide-react";

// ── CSV export ────────────────────────────────────────────────────────────
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

// ── Cannibalization SVG Network Graph ──────────────────────────────────────
function CannibalizationGraph({ rows }: { rows: Record<string, unknown>[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const W = 640, H = Math.max(rows.length * 80 + 60, 260);
  const LX = 130, RX = W - 130;
  const rowH = (H - 60) / Math.max(rows.length, 1);

  function nodeY(i: number) { return 40 + i * rowH + rowH / 2; }

  // unique declining (left) and rising (right) products
  const declining = Array.from(new Set(rows.map(r => String(r.product_a ?? r.declining ?? ""))));
  const rising    = Array.from(new Set(rows.map(r => String(r.product_b ?? r.rising ?? ""))));

  // positions by unique products
  const declineH = H / Math.max(declining.length, 1);
  const riseH    = H / Math.max(rising.length, 1);
  function decY(name: string) { const i = declining.indexOf(name); return 30 + i * declineH + declineH / 2; }
  function risY(name: string) { const i = rising.indexOf(name);    return 30 + i * riseH    + riseH    / 2; }

  const totalH = Math.max(Math.max(declining.length, rising.length) * 72 + 60, 240);

  return (
    <div ref={ref} style={{ padding: "16px 20px", overflowX: "auto" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${totalH}`} style={{ display: "block", fontFamily: "Inter, sans-serif" }}>
        {/* Column headers */}
        <text x={LX} y={18} textAnchor="middle" fontSize={10} fill={DS.red}    fontWeight="700" letterSpacing="1">DECLINING ▼</text>
        <text x={RX} y={18} textAnchor="middle" fontSize={10} fill={DS.green}  fontWeight="700" letterSpacing="1">RISING ▲</text>

        {/* Arcs for each pair */}
        {rows.map((r, i) => {
          const a = String(r.product_a ?? r.declining ?? "");
          const b = String(r.product_b ?? r.rising ?? "");
          const y1 = decY(a), y2 = risY(b);
          const midX = W / 2;
          const isHov = hovered === i;
          const overlap = Number(r.overlap_partners ?? 0);
          const strokeW = Math.max(1, Math.min(overlap / 3, 6));
          return (
            <g key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            >
              <path
                d={`M ${LX + 10} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${RX - 10} ${y2}`}
                fill="none"
                stroke={isHov ? "#8b5cf6" : "rgba(239,68,68,0.3)"}
                strokeWidth={isHov ? strokeW + 1 : strokeW}
                strokeDasharray={isHov ? "none" : "5,3"}
              />
              {/* Arrow head */}
              <polygon
                points={`${RX - 10},${y2} ${RX - 16},${y2 - 4} ${RX - 16},${y2 + 4}`}
                fill={isHov ? "#8b5cf6" : "rgba(239,68,68,0.5)"}
              />
              {/* Mid label: overlap */}
              {overlap > 0 && (
                <>
                  <circle cx={midX} cy={(y1 + y2) / 2} r={13} fill={isHov ? "#7c3aed" : "#e0e7ff"} />
                  <text x={midX} y={(y1 + y2) / 2 + 4} textAnchor="middle" fontSize={9} fontWeight="800"
                    fill={isHov ? "#fff" : DS.primary}>{overlap}</text>
                </>
              )}
            </g>
          );
        })}

        {/* Declining nodes (left column) */}
        {declining.map((name, i) => {
          const y = decY(name);
          const trunc = name.length > 22 ? name.slice(0, 22) + "…" : name;
          const drop = rows.find(r => String(r.product_a ?? r.declining) === name);
          return (
            <g key={name}>
              <rect x={2} y={y - 18} width={LX - 14} height={36} rx={8}
                fill="#FEF2F2" stroke="#fca5a5" strokeWidth={1.5} />
              <text x={LX / 2} y={y - 4} textAnchor="middle" fontSize={9.5} fontWeight="700" fill={DS.red}>{trunc}</text>
              {drop?.a_revenue_drop !== undefined && (
                <text x={LX / 2} y={y + 10} textAnchor="middle" fontSize={8.5} fill={DS.red}>
                  ↓ {Number(drop.a_revenue_drop).toFixed(1)}%
                </text>
              )}
            </g>
          );
        })}

        {/* Rising nodes (right column) */}
        {rising.map((name, i) => {
          const y = risY(name);
          const trunc = name.length > 22 ? name.slice(0, 22) + "…" : name;
          const gain = rows.find(r => String(r.product_b ?? r.rising) === name);
          return (
            <g key={name}>
              <rect x={RX + 12} y={y - 18} width={W - RX - 14} height={36} rx={8}
                fill="#ECFDF5" stroke="#6ee7b7" strokeWidth={1.5} />
              <text x={RX + (W - RX) / 2} y={y - 4} textAnchor="middle" fontSize={9.5} fontWeight="700" fill={DS.green}>{trunc}</text>
              {gain?.b_revenue_gain !== undefined && (
                <text x={RX + (W - RX) / 2} y={y + 10} textAnchor="middle" fontSize={8.5} fill={DS.green}>
                  ↑ {Number(gain.b_revenue_gain).toFixed(1)}%
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {hovered !== null && rows[hovered] && (
        <div style={{
          background: "#fff", border: "1px solid rgba(199,196,216,0.3)", borderRadius: 10,
          padding: "10px 16px", fontSize: 11.5, boxShadow: "0 4px 16px rgba(25,28,30,0.1)",
          marginTop: 8, display: "inline-block",
        }}>
          <p style={{ fontWeight: 800, marginBottom: 4 }}>
            <span style={{ color: DS.red }}>↓ {String(rows[hovered].product_a ?? rows[hovered].declining ?? "")}</span>
            {" → "}
            <span style={{ color: DS.green }}>↑ {String(rows[hovered].product_b ?? rows[hovered].rising ?? "")}</span>
          </p>
          {rows[hovered].overlap_partners !== undefined && <p style={{ color: DS.textMuted }}>👥 {String(rows[hovered].overlap_partners)} shared partners</p>}
          {rows[hovered].a_revenue_drop   !== undefined && <p style={{ color: DS.red   }}>A drop: {Number(rows[hovered].a_revenue_drop).toFixed(1)}%</p>}
          {rows[hovered].b_revenue_gain   !== undefined && <p style={{ color: DS.green }}>B gain: {Number(rows[hovered].b_revenue_gain).toFixed(1)}%</p>}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 10.5, color: DS.textMuted, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 20, height: 2, background: "rgba(239,68,68,0.4)", display: "inline-block" }} />Cannibalisation arc</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: "50%", background: "#e0e7ff", display: "inline-block" }} />Circle = shared partners</span>
        <span>Arc width ∝ partner overlap</span>
        <span style={{ marginLeft: "auto", fontStyle: "italic" }}>Hover an arc to see pair details</span>
      </div>
    </div>
  );
}

const TT = { background: "#fff", border: "1px solid rgba(199,196,216,0.3)", borderRadius: 10, fontSize: 11 };

function fmt(v: unknown): string {
  const n = Number(v);
  if (!v && v !== 0) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toFixed(0)}`;
}

const STAGE_COLOR: Record<string, string> = {
  Star: "#f59e0b", Growing: DS.green, Mature: DS.blue, Declining: DS.red, Niche: "#8b5cf6", Plateauing: "#64748b",
};
const PIE_COLORS = ["#f59e0b", DS.green, DS.blue, DS.red, "#8b5cf6", "#64748b"];
const URGENCY_CFG: Record<string, { cls: string; color: string }> = {
  Critical: { cls: "badge-red",   color: DS.red },
  Warning:  { cls: "badge-amber", color: DS.amber },
  Watch:    { cls: "badge-blue",  color: DS.blue },
};

export default function ProductLifecyclePage() {
  const [stageFilter, setStageFilter] = useState("All");
  const [urgFilter, setUrgFilter] = useState("All");
  const [drillProduct, setDrillProduct] = useState<string | null>(null);
  const [discount, setDiscount] = useState(15);
  const [bundlePartner, setBundlePartner] = useState("your top distributors");

  const { data: sumData, isLoading, error } = useQuery({ queryKey: ["lc-summary"], queryFn: api.lifecycle.summary });
  const { data: velData } = useQuery({
    queryKey: ["lc-vel", stageFilter],
    queryFn: () => api.lifecycle.velocity(stageFilter === "All" ? undefined : stageFilter),
  });
  const { data: eolData } = useQuery({
    queryKey: ["lc-eol", urgFilter],
    queryFn: () => api.lifecycle.eol(urgFilter === "All" ? undefined : urgFilter),
  });
  const { data: canniData } = useQuery({ queryKey: ["lc-canni"], queryFn: api.lifecycle.cannibalization });
  const { data: trendData } = useQuery({
    queryKey: ["lc-trend", drillProduct],
    queryFn: () => api.lifecycle.trend(drillProduct!),
    enabled: !!drillProduct,
  });

  const sumRows = (sumData?.rows ?? []) as Record<string, unknown>[];
  const velRows = (velData?.rows ?? []) as Record<string, unknown>[];
  const eolRows = (eolData?.rows ?? []) as Record<string, unknown>[];
  const canniRows = (canniData?.rows ?? []) as Record<string, unknown>[];
  const trendRows = (trendData?.rows ?? []) as Record<string, unknown>[];

  // Pipeline overview KPIs
  const total     = sumRows.length;
  const growing   = sumRows.filter(r => String(r.stage).toLowerCase() === "growing"   || String(r.stage).toLowerCase() === "star").length;
  const mature    = sumRows.filter(r => String(r.stage).toLowerCase() === "mature").length;
  const declining = sumRows.filter(r => String(r.stage).toLowerCase() === "declining").length;
  const plateauing= sumRows.filter(r => String(r.stage).toLowerCase() === "plateauing").length;
  const niche     = sumRows.filter(r => String(r.stage).toLowerCase() === "niche").length;

  // Donut data
  const stagesAll = Array.from(new Set(sumRows.map(r => String(r.stage ?? "Unknown"))));
  const pieData = stagesAll.map(s => ({ name: s, value: sumRows.filter(r => String(r.stage) === s).length }));

  // Velocity rows grouped by stage
  const stages = Array.from(new Set(velRows.map(r => String(r.stage ?? "Unknown"))));

  // Quadrant scatter: x=growth_3m_pct, y=revenue, z=buyer_count
  const medX = velRows.length ? velRows.reduce((s, r) => s + Number(r.growth_3m_pct ?? 0), 0) / velRows.length : 0;
  const medY = velRows.length ? velRows.reduce((s, r) => s + Number(r.total_revenue ?? r.revenue ?? 0), 0) / velRows.length : 0;

  // Clearance action script
  const clearanceProduct = drillProduct || (eolRows[0] ? String(eolRows[0].product ?? "") : "Product");
  const clearanceScript = `📢 Flash Deal Alert — ${discount}% OFF on ${clearanceProduct}!\n\nThis is a limited-time offer for ${bundlePartner}.\n\n✅ Why act now?\n• Stock moving fast — last chance at current prices\n• Bundle with complementary products for even better margins\n• Priority allocation for early orders\n\n📞 Call or WhatsApp your rep today — offer valid for 48 hours only.`;

  if (isLoading) return <LoadingSkeleton lines={6} />;
  if (error) return <ErrorBanner message="Failed to load lifecycle data." />;

  return (
    <div style={{ animation: "fadeIn 0.25s ease-out" }}>
      <div className="page-hero" style={{ "--hero-accent": "#10b981" } as React.CSSProperties}>
        <span className="page-hero-icon">🔄</span>
        <div>
          <div className="page-hero-title">Product Lifecycle</div>
          <div className="page-hero-sub">Velocity scoring · Stage classification · EOL prediction · Cannibalization detection</div>
        </div>
      </div>

      {/* Velocity formula strip */}
      <div className="info-banner info-banner-blue" style={{ marginBottom: 18, fontFamily: "monospace", fontSize: 12 }}>
        Velocity = 0.40 × slope_pct + 0.35 × growth_3m_pct + 0.15 × buyer_trend + 0.10 × txn_intensity
      </div>

      {/* 6-metric overview */}
      <SectionLabel>Lifecycle Overview</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total Products", value: total, color: DS.primary },
          { label: "Growing / Star", value: growing, color: DS.green },
          { label: "Mature", value: mature, color: DS.blue },
          { label: "Plateauing", value: plateauing, color: "#64748b" },
          { label: "Declining", value: declining, color: DS.red },
          { label: "Niche", value: niche, color: "#8b5cf6" },
        ].map(({ label, value, color }) => (
          <div key={label} className="metric-card" style={{ padding: "12px 14px" }}>
            <p className="kpi-label">{label}</p>
            <p className="kpi-val" style={{ color, fontSize: "1.5rem" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Donut + Quadrant scatter */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16, marginBottom: 20 }}>
        {/* Stage donut */}
        <Panel>
          <PanelHeader title="Stage Distribution" sub="Count per lifecycle stage" />
          <div style={{ padding: "8px 4px" }}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={110} dataKey="value" paddingAngle={3}>
                  {pieData.map((e, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={TT} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Revenue vs Growth quadrant scatter */}
        <Panel>
          <PanelHeader title="Revenue vs Growth Quadrant" sub="Median lines divide quadrants" />
          <div style={{ padding: "8px 4px" }}>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ left: 40, right: 10, top: 8, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(199,196,216,0.15)" />
                <XAxis dataKey="growth_3m_pct" type="number" name="Growth 3m %" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} label={{ value: "Growth 3m %", position: "insideBottom", offset: -8, fontSize: 9 }} />
                <YAxis dataKey="total_revenue" type="number" name="Revenue" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
                <ZAxis dataKey="buyer_count" range={[20, 200]} />
                <ReferenceLine x={medX} stroke="rgba(199,196,216,0.6)" strokeDasharray="4 4" />
                <ReferenceLine y={medY} stroke="rgba(199,196,216,0.6)" strokeDasharray="4 4" />
                <Tooltip contentStyle={TT} content={({ payload }) => {
                  if (!payload?.length) return null;
                  const p = payload[0].payload as Record<string, unknown>;
                  return (
                    <div style={{ background: "#fff", border: "1px solid rgba(199,196,216,0.3)", borderRadius: 10, padding: "10px 14px", fontSize: 11 }}>
                      <p style={{ fontWeight: 700 }}>{String(p.product ?? "")}</p>
                      <p style={{ color: STAGE_COLOR[String(p.stage)] ?? DS.primary }}>{String(p.stage ?? "")}</p>
                      <p>Revenue: {fmt(p.total_revenue ?? p.revenue)}</p>
                      <p>Growth 3m: {Number(p.growth_3m_pct ?? 0).toFixed(1)}%</p>
                    </div>
                  );
                }} />
                <Scatter data={velRows} onClick={d => setDrillProduct(String((d as unknown as Record<string, unknown>).product ?? null))}>
                  {velRows.map((r, i) => <Cell key={i} fill={STAGE_COLOR[String(r.stage ?? "")] ?? DS.primary} fillOpacity={0.75} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p style={{ padding: "0 16px 10px", fontSize: 11, color: DS.textMuted }}>Click any point to see revenue history drilldown below.</p>
        </Panel>
      </div>

      {/* Revenue history drilldown */}
      {drillProduct && (
        <>
          <SectionLabel>📈 Revenue History — {drillProduct}</SectionLabel>
          <Panel style={{ marginBottom: 20 }}>
            <PanelHeader title={drillProduct} sub="Monthly revenue trend" />
            <div style={{ padding: "8px 4px 16px" }}>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={trendRows} margin={{ left: 50, right: 10, top: 8, bottom: 4 }}>
                  <defs>
                    <linearGradient id="lcGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={DS.green} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={DS.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(199,196,216,0.15)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
                  <Tooltip contentStyle={TT} formatter={v => [fmt(v as number), "Revenue"]} />
                  <Area type="monotone" dataKey="revenue" stroke={DS.green} strokeWidth={2.5} fill="url(#lcGrad)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </>
      )}

      {/* Velocity Scorecard grouped by stage */}
      <SectionLabel>Velocity Scorecard</SectionLabel>
      <Panel style={{ marginBottom: 20 }}>
        <div style={{ padding: "10px 16px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderBottom: "1px solid rgba(199,196,216,0.12)" }}>
          {["All", ...stages].map(s => (
            <button key={s} className={`btn ${stageFilter === s ? "btn-primary" : "btn-ghost"}`} style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setStageFilter(s)}>{s}</button>
          ))}
          <span style={{ marginLeft: "auto" }}>
            <Btn variant="outline" size="sm" onClick={() => downloadCSV(
              velRows.map(r => ({
                product: String(r.product ?? ""),
                stage: String(r.stage ?? ""),
                velocity_score: Number(r.velocity_score ?? 0).toFixed(3),
                growth_3m_pct: Number(r.growth_3m_pct ?? 0).toFixed(2),
                slope_pct: Number(r.slope_pct ?? 0).toFixed(3),
                buyer_trend: Number(r.buyer_trend ?? 0).toFixed(4),
                total_revenue: Number(r.total_revenue ?? r.revenue ?? 0),
                revenue_cv: Number(r.revenue_cv ?? 0).toFixed(3),
              })),
              "velocity_scorecard.csv"
            )}><Download size={10} />Export CSV</Btn>
          </span>
        </div>
        <div style={{ overflowX: "auto", maxHeight: 380, overflowY: "auto" }}>
          <table className="data-table">
            <thead><tr>
              <th>Product</th><th>Stage</th><th>Velocity</th><th>Growth 3m</th><th>Slope</th><th>Buyer Trend</th><th>Revenue</th><th>Rev CV</th>
            </tr></thead>
            <tbody>
              {velRows.map((r, i) => {
                const stage = String(r.stage ?? "");
                const color = STAGE_COLOR[stage] ?? DS.primary;
                const vel = Number(r.velocity_score ?? 0);
                return (
                  <tr key={i} style={{ cursor: "pointer" }} onClick={() => setDrillProduct(String(r.product ?? null))}>
                    <td style={{ fontWeight: 700 }}>{String(r.product ?? "")}</td>
                    <td><span className="badge" style={{ background: color + "20", color }}>{stage}</span></td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 700, color: vel >= 0 ? DS.green : DS.red }}>{vel.toFixed(2)}</span>
                        <div style={{ width: 50, height: 4, background: "#e6e8ea", borderRadius: 999 }}>
                          <div style={{ width: `${Math.min(100, Math.abs(vel) * 100)}%`, height: "100%", background: vel >= 0 ? DS.green : DS.red, borderRadius: 999 }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ color: Number(r.growth_3m_pct ?? 0) >= 0 ? DS.green : DS.red, fontWeight: 600 }}>
                      {Number(r.growth_3m_pct ?? 0) >= 0 ? <TrendingUp size={10} style={{ display: "inline" }} /> : <TrendingDown size={10} style={{ display: "inline" }} />} {Number(r.growth_3m_pct ?? 0).toFixed(1)}%
                    </td>
                    <td style={{ color: DS.textMuted }}>{Number(r.slope_pct ?? 0).toFixed(2)}</td>
                    <td style={{ color: DS.textMuted }}>{Number(r.buyer_trend ?? 0).toFixed(3)}</td>
                    <td>{fmt(r.total_revenue ?? r.revenue)}</td>
                    <td style={{ color: DS.textMuted }}>{Number(r.revenue_cv ?? 0).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {velRows.length === 0 && <EmptyState message="No velocity data available." />}
      </Panel>

      {/* EOL Predictions */}
      <SectionLabel>EOL Risk Predictions</SectionLabel>
      <Panel style={{ marginBottom: 20 }}>
        <div style={{ padding: "10px 16px", display: "flex", gap: 8, flexWrap: "wrap", borderBottom: "1px solid rgba(199,196,216,0.12)" }}>
          {["All", "Critical", "Warning", "Watch"].map(u => (
            <button key={u} className={`btn ${urgFilter === u ? "btn-primary" : "btn-ghost"}`} style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setUrgFilter(u)}>{u}</button>
          ))}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead><tr>
              <th>Product</th><th>EOL Urgency</th><th>EOL Risk Score</th><th>Months to Zero</th><th>Decline Rate</th><th>Revenue</th>
            </tr></thead>
            <tbody>
              {eolRows.map((r, i) => {
                const urgency = String(r.eol_urgency ?? r.urgency ?? "Watch");
                const cfg = URGENCY_CFG[urgency] ?? { cls: "badge-gray", color: DS.textMuted };
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{String(r.product ?? "")}</td>
                    <td><span className={`badge ${cfg.cls}`}>{urgency}</span></td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, color: cfg.color, fontFamily: "Manrope" }}>{Number(r.eol_risk_score ?? 0).toFixed(3)}</span>
                        <div className="gauge-track" style={{ width: 60, margin: 0 }}>
                          <div className="gauge-fill" style={{ width: `${Number(r.eol_risk_score ?? 0) * 100}%`, background: cfg.color }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ color: cfg.color, fontWeight: 600 }}>{r.months_to_zero !== undefined ? `${Number(r.months_to_zero).toFixed(0)}mo` : "—"}</td>
                    <td style={{ color: DS.red }}>{r.decline_rate_pct ? `${Number(r.decline_rate_pct).toFixed(1)}%` : "—"}</td>
                    <td>{fmt(r.total_revenue ?? r.revenue)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {eolRows.length === 0 && <EmptyState message="No EOL predictions available." />}
      </Panel>

      {/* Cannibalization network graph */}
      {canniRows.length > 0 && (
        <>
          <SectionLabel>Cannibalization Detection</SectionLabel>
          <Panel style={{ marginBottom: 20 }}>
            <PanelHeader title="Product Cannibalization Network" subtitle={`${canniRows.length} pairs · Red = declining, Green = rising, arc = cannibalisation flow`} />
            <CannibalizationGraph rows={canniRows} />
          </Panel>
        </>
      )}

      {/* Clearance Action Generator */}
      <SectionLabel><Flame size={12} style={{ display: "inline", marginRight: 4, color: "#ef4444" }} />Clearance Action Generator</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16 }}>
        <Panel>
          <div style={{ padding: "18px" }}>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: DS.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Product (or select from EOL list)</p>
              <select className="form-select" value={drillProduct ?? ""} onChange={e => setDrillProduct(e.target.value || null)}>
                <option value="">Auto (top EOL risk product)</option>
                {eolRows.map((r, i) => <option key={i} value={String(r.product ?? "")}>{String(r.product ?? "")}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: DS.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Discount: {discount}%</p>
              <input type="range" min={5} max={50} step={5} value={discount} onChange={e => setDiscount(Number(e.target.value))} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: DS.textMuted, marginTop: 4 }}><span>5%</span><span>50%</span></div>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: DS.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Target (partner segment or name)</p>
              <input className="form-input" value={bundlePartner} onChange={e => setBundlePartner(e.target.value)} placeholder="e.g. VIP partners in Maharashtra" />
            </div>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Generated Flash Deal Script" sub="Ready to copy + send via WhatsApp / Email" />
          <div style={{ padding: "16px 20px" }}>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "Inter, sans-serif", fontSize: 12.5, lineHeight: 1.75, color: DS.textMuted }}>
              {clearanceScript}
            </pre>
          </div>
        </Panel>
      </div>
    </div>
  );
}
