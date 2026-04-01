"use client";
import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DS } from "@/lib/ds";
import { Panel, PanelHeader, SectionLabel, LoadingSkeleton, ErrorBanner, EmptyState, Btn } from "@/components/ui";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, BarChart, Bar, Legend,
} from "recharts";
import { Layers, Star, TrendingUp, Shield, AlertCircle, Download, X, ChevronUp, ChevronDown } from "lucide-react";

const TT = { background: "#fff", border: "1px solid rgba(199,196,216,0.3)", borderRadius: 10, fontSize: 11, boxShadow: "0 4px 16px rgba(25,28,30,0.08)" };

const TYPE_CONFIG: Record<string, { color: string; badge: string; icon: React.ReactNode }> = {
  VIP:      { color: "#f59e0b", badge: "badge-amber",  icon: <Star size={10} /> },
  Growth:   { color: DS.green,  badge: "badge-green",  icon: <TrendingUp size={10} /> },
  Standard: { color: DS.blue,   badge: "badge-blue",   icon: <Shield size={10} /> },
  Outlier:  { color: DS.red,    badge: "badge-red",    icon: <AlertCircle size={10} /> },
};

function fmt(n: unknown) {
  const v = Number(n);
  if (!n && n !== 0) return "—";
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000)   return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)     return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v.toFixed(0)}`;
}

// ── Pill-chip toggle button ─────────────────────────────────────────────────
function Chip({ label, active, color, onClick }: { label: string; active: boolean; color?: string; onClick: () => void }) {
  const activeColor = color ?? DS.primary;
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "4px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: active ? 700 : 500,
      border: `1.5px solid ${active ? activeColor : "rgba(199,196,216,0.4)"}`,
      background: active ? `${activeColor}18` : "#fff",
      color: active ? activeColor : DS.textMuted,
      cursor: "pointer", transition: "all 0.13s", whiteSpace: "nowrap",
    }}>
      {label}
    </button>
  );
}

// ── Mini revenue-share bar ─────────────────────────────────────────────────
function RevenueBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <span style={{ fontSize: 9.5, color: DS.textMuted, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Revenue Share</span>
        <span style={{ fontSize: 11, fontWeight: 800, color }}>{pct.toFixed(1)}%</span>
      </div>
      <div style={{ height: 5, background: "rgba(199,196,216,0.25)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: `linear-gradient(90deg, ${color}99, ${color})`, borderRadius: 999, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

// ── CSV Download ───────────────────────────────────────────────────────────
function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [
    keys.join(","),
    ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function ClusterIntelligencePage() {
  const [filterType, setFilterType] = useState("All");
  const [filterLabel, setFilterLabel] = useState("All");
  const [drillCluster, setDrillCluster] = useState<string | null>(null);
  const [drillSortKey, setDrillSortKey] = useState("revenue");
  const [drillSortAsc, setDrillSortAsc] = useState(false);

  const { data: summaryData, isLoading, error } = useQuery({ queryKey: ["cluster-summary"], queryFn: api.clustering.summary });
  const { data: matrixData } = useQuery({ queryKey: ["cluster-matrix"], queryFn: api.clustering.matrix });

  const clusters = (summaryData?.clusters as Record<string, unknown>[]) ?? [];
  const metrics  = (summaryData?.metrics  as Record<string, unknown>) ?? {};
  const scatter  = useMemo(() =>
    (summaryData?.scatter_data ?? summaryData?.pca_data ?? matrixData?.scatter_data ?? []) as Record<string, unknown>[],
    [summaryData, matrixData]
  );

  // Normalise scatter so x/y/z always exist (support pc1/pc2 or x/y naming)
  const normScatter = useMemo(() => scatter.map(p => ({
    ...p,
    x: Number(p.pc1 ?? p.x ?? p.dim1 ?? 0),
    y: Number(p.pc2 ?? p.y ?? p.dim2 ?? 0),
    z: Number(p.revenue ?? p.total_revenue ?? p.avg_revenue ?? p.z ?? 50),
    partner_name: String(p.partner_name ?? p.name ?? p.company_name ?? ""),
    cluster_type: String(p.cluster_type ?? "Standard"),
    cluster_label: String(p.cluster_label ?? p.label ?? ""),
    state: String(p.state ?? ""),
    strategic_tag: String(p.strategic_tag ?? ""),
  })), [scatter]);

  const allTypes  = useMemo(() => Array.from(new Set(clusters.map(c => String(c.cluster_type ?? "")))).filter(Boolean), [clusters]);
  const allLabels = useMemo(() => Array.from(new Set(clusters.map(c => String(c.cluster_label ?? c.label ?? "")))).filter(Boolean), [clusters]);

  const filteredClusters = clusters.filter(c =>
    (filterType === "All" || String(c.cluster_type ?? "") === filterType) &&
    (filterLabel === "All" || String(c.cluster_label ?? c.label ?? "") === filterLabel)
  );

  const filteredScatter = normScatter.filter(p =>
    (filterType === "All" || p.cluster_type === filterType) &&
    (filterLabel === "All" || p.cluster_label === filterLabel)
  );

  // Drill-down partners — full KPI table
  const rawDrillPartners = drillCluster ? normScatter.filter(p => p.cluster_label === drillCluster) : [];
  type NormPoint = typeof normScatter[0];
  const drillPartners = useMemo(() => {
    return [...rawDrillPartners].sort((a, b) => {
      const va = Number((a as Record<string, unknown>)[drillSortKey] ?? 0);
      const vb = Number((b as Record<string, unknown>)[drillSortKey] ?? 0);
      return drillSortAsc ? va - vb : vb - va;
    });
  }, [rawDrillPartners, drillSortKey, drillSortAsc]);

  const toggleSort = useCallback((key: string) => {
    if (drillSortKey === key) setDrillSortAsc(p => !p);
    else { setDrillSortKey(key); setDrillSortAsc(false); }
  }, [drillSortKey]);

  const SortIcon = ({ k }: { k: string }) => drillSortKey !== k ? null :
    drillSortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />;

  // Composition bar — top-8 labels by total partners only
  const compositionData = useMemo(() => {
    return allLabels
      .map(lbl => {
        const clusterRows = clusters.filter(c => String(c.cluster_label ?? c.label ?? "") === lbl);
        const obj: Record<string, unknown> = {
          label: lbl.length > 20 ? lbl.slice(0, 20) + "…" : lbl,
          _total: clusterRows.length,
        };
        allTypes.forEach(t => { obj[t] = clusterRows.filter(c => String(c.cluster_type ?? "") === t).length; });
        return obj;
      })
      .sort((a, b) => Number(b._total) - Number(a._total))
      .slice(0, 8);
  }, [allLabels, allTypes, clusters]);

  // Max revenue for spark bars
  const maxRevShare = useMemo(() =>
    Math.max(...clusters.map(c => Number(c.revenue_share ?? 0) * 100), 1),
    [clusters]
  );

  // CSV export
  const handleDownloadCSV = () => {
    const rows = clusters.map(c => ({
      cluster_label: String(c.cluster_label ?? c.label ?? ""),
      cluster_type: String(c.cluster_type ?? ""),
      partner_count: Number(c.partner_count ?? 0),
      avg_revenue: Number(c.avg_revenue ?? 0),
      revenue_share_pct: (Number(c.revenue_share ?? 0) * 100).toFixed(2),
      churn_rate_pct: (Number(c.churn_rate ?? 0) * 100).toFixed(2),
      strategic_tag: String(c.strategic_tag ?? ""),
    }));
    downloadCSV(rows, "cluster_report.csv");
  };

  if (isLoading) return <LoadingSkeleton lines={6} />;
  if (error) return <ErrorBanner message="Could not load clustering data." />;

  return (
    <div style={{ animation: "fadeIn 0.25s ease-out" }}>
      {/* Hero */}
      <div className="page-hero" style={{ "--hero-accent": "#8b5cf6" } as React.CSSProperties}>
        <span className="page-hero-icon"><Layers size={28} color="#8b5cf6" /></span>
        <div>
          <div className="page-hero-title">Cluster Intelligence</div>
          <div className="page-hero-sub">HDBSCAN · GMM · Spectral — consensus labelling of partner segments based on 12+ behavioural features.</div>
        </div>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Btn variant="outline" size="sm" onClick={handleDownloadCSV}><Download size={11} />Download CSV</Btn>
        </span>
      </div>

      {/* Algorithm chips */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
        {[
          { label: "HDBSCAN", desc: "Density peaks · outlier detection", color: "#8b5cf6" },
          { label: "GMM", desc: "Soft probability assignments", color: DS.primary },
          { label: "Spectral", desc: "Graph-based manifold clusters", color: "#06b6d4" },
        ].map(({ label, desc, color }) => (
          <div key={label} className="card" style={{ padding: "10px 14px", borderLeft: `3px solid ${color}` }}>
            <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color }}>{label}</p>
            <p style={{ fontSize: 11, color: DS.textMuted, marginTop: 2 }}>{desc}</p>
          </div>
        ))}
      </div>

      {/* Quality Metrics */}
      <SectionLabel>Model Quality Metrics</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Silhouette Score", key: "silhouette_score", formula: "(-1 → 1) Cluster separation", color: DS.green },
          { label: "Calinski-Harabasz", key: "calinski_harabasz_score", formula: "Higher = denser, better separated", color: DS.primary },
          { label: "Adj. Rand Index", key: "adjusted_rand_index", formula: "Consensus model agreement", color: "#8b5cf6" },
          { label: "Total Partners", key: "total_partners", formula: "Partners in current model run", color: DS.blue },
        ].map(({ label, key, formula, color }) => (
          <div key={key} className="metric-card">
            <p className="kpi-label">{label}</p>
            <p className="kpi-val" style={{ color, fontSize: "1.5rem" }}>
              {metrics[key] != null ? (typeof metrics[key] === "number" ? (metrics[key] as number).toFixed(3) : String(metrics[key])) : "—"}
            </p>
            <p className="kpi-sub" style={{ marginTop: 4 }}>{formula}</p>
          </div>
        ))}
      </div>

      {/* ── Pill-chip Filters ─────────────────────────────────────────────── */}
      <Panel style={{ marginBottom: 18 }}>
        <div style={{ padding: "14px 18px" }}>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {/* Type filter */}
            <div>
              <p style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: DS.textMuted, marginBottom: 8 }}>Cluster Type</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Chip label="All" active={filterType === "All"} onClick={() => setFilterType("All")} />
                {allTypes.map(t => (
                  <Chip key={t} label={t} active={filterType === t} color={TYPE_CONFIG[t]?.color} onClick={() => setFilterType(t)} />
                ))}
              </div>
            </div>
            {/* Label filter */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: DS.textMuted, marginBottom: 8 }}>Cluster Label</p>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                <Chip label="All" active={filterLabel === "All"} onClick={() => setFilterLabel("All")} />
                {allLabels.map(l => (
                  <Chip key={l} label={l} active={filterLabel === l} color="#6366f1" onClick={() => setFilterLabel(l)} />
                ))}
              </div>
            </div>
          </div>
          <p style={{ fontSize: 11, color: DS.textMuted, marginTop: 10 }}>
            Showing <strong>{filteredClusters.length}</strong> of {clusters.length} clusters · <strong>{filteredScatter.length}</strong> partners plotted
            {(filterType !== "All" || filterLabel !== "All") && (
              <button onClick={() => { setFilterType("All"); setFilterLabel("All"); }}
                style={{ marginLeft: 10, fontSize: 10.5, color: DS.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
                <X size={10} /> Clear filters
              </button>
            )}
          </p>
        </div>
      </Panel>

      {/* ── Main 2-col: Scatter + Composition ─────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* PCA Scatter */}
        <Panel>
          <PanelHeader title="Partner PCA Scatter" subtitle={`${filteredScatter.length} partners · Click a point to drill in`} />
          <div style={{ padding: "4px 4px 0" }}>
            {normScatter.length === 0 ? (
              <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <EmptyState message="No scatter data returned by the API. Run clustering first." />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={330}>
                <ScatterChart margin={{ left: 14, right: 14, top: 10, bottom: 14 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(199,196,216,0.15)" />
                  <XAxis dataKey="x" type="number" name="PC1" tick={{ fontSize: 9 }} axisLine={false} tickLine={false}
                    label={{ value: "PC1", position: "insideBottom", offset: -6, fontSize: 9, fill: DS.textMuted }} />
                  <YAxis dataKey="y" type="number" name="PC2" tick={{ fontSize: 9 }} axisLine={false} tickLine={false}
                    label={{ value: "PC2", angle: -90, position: "insideLeft", offset: 8, fontSize: 9, fill: DS.textMuted }} />
                  <ZAxis dataKey="z" range={[18, 180]} name="Revenue" />
                  <Tooltip contentStyle={TT} cursor={{ strokeDasharray: "3 3" }}
                    content={({ payload }) => {
                      if (!payload?.length) return null;
                      const p = payload[0].payload as typeof normScatter[0];
                      const cfg = TYPE_CONFIG[p.cluster_type] ?? { color: DS.primary };
                      return (
                        <div style={{ background: "#fff", border: "1px solid rgba(199,196,216,0.3)", borderRadius: 10, padding: "10px 14px", fontSize: 11, minWidth: 170, boxShadow: "0 4px 16px rgba(25,28,30,0.1)" }}>
                          <p style={{ fontWeight: 800, marginBottom: 5, fontSize: 12 }}>{p.partner_name || "Partner"}</p>
                          {p.state && <p style={{ color: DS.textMuted, marginBottom: 3 }}>📍 {p.state}</p>}
                          <p>Type: <b style={{ color: cfg.color }}>{p.cluster_type}</b></p>
                          <p>Cluster: <b>{p.cluster_label}</b></p>
                          {p.z > 50 && <p>Revenue: {fmt(p.z)}</p>}
                          {p.strategic_tag && p.strategic_tag !== "undefined" && <p>🏷 {p.strategic_tag}</p>}
                        </div>
                      );
                    }}
                  />
                  {allTypes.map(t => {
                    const typePoints = filteredScatter.filter(p => p.cluster_type === t);
                    return (
                      <Scatter key={t} name={t} data={typePoints}
                        onClick={pt => { const l = (pt as unknown as NormPoint).cluster_label; setDrillCluster(prev => prev === l ? null : l); }}
                      >
                        {typePoints.map((_, i) => (
                          <Cell key={i} fill={TYPE_CONFIG[t]?.color ?? DS.primary} fillOpacity={0.75} />
                        ))}
                      </Scatter>
                    );
                  })}
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, padding: "6px 16px 12px", flexWrap: "wrap" }}>
            {allTypes.map(t => (
              <span key={t} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: DS.textMuted }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: TYPE_CONFIG[t]?.color ?? DS.primary, display: "inline-block" }} />
                {t}
              </span>
            ))}
          </div>
        </Panel>

        {/* Composition bar — top-8 with horizontal scroll */}
        <Panel>
          <PanelHeader title="Cluster Composition" subtitle="Top 8 labels by partner count" />
          <div style={{ overflowX: "auto", padding: "4px 4px 8px" }}>
            <div style={{ minWidth: Math.max(compositionData.length * 60, 220) }}>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={compositionData} margin={{ left: 0, right: 8, top: 8, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(199,196,216,0.15)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: DS.textMuted }} angle={-35} textAnchor="end"
                    axisLine={false} tickLine={false} interval={0} height={52} />
                  <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TT} />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                  {allTypes.map((t, ti) => (
                    <Bar key={t} dataKey={t} stackId="a" fill={TYPE_CONFIG[t]?.color ?? DS.primary}
                      radius={ti === allTypes.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      cursor="pointer"
                      onClick={(data: unknown) => { const d = data as Record<string, unknown>; setDrillCluster(prev => prev === String(d.label) ? null : String(d.label)); }}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Panel>
      </div>

      {/* ── Cluster Cards ──────────────────────────────────────────────────── */}
      <SectionLabel>Cluster Segments ({filteredClusters.length})</SectionLabel>
      {filteredClusters.length === 0 ? (
        <EmptyState message="No clusters match the current filters." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
          {filteredClusters.map((c, i) => {
            const type = String(c.cluster_type ?? "Standard");
            const cfg = TYPE_CONFIG[type] ?? { color: DS.primary, badge: "badge-indigo", icon: <Star size={10} /> };
            const lbl = String(c.cluster_label ?? c.label ?? `Cluster ${i}`);
            const partnerCount = Number(c.partner_count ?? 0);
            const avgRev = Number(c.avg_revenue ?? 0);
            const churnRate = Number(c.churn_rate ?? 0);
            const revShare = Number(c.revenue_share ?? 0) * 100;
            const totalRevShare = Math.max(maxRevShare, 1);
            const isActive = drillCluster === lbl;

            return (
              <div key={i} className="card"
                style={{
                  padding: "16px", borderTop: `3px solid ${cfg.color}`,
                  cursor: "pointer", transition: "box-shadow 0.14s, transform 0.14s",
                  boxShadow: isActive ? `0 0 0 2px ${cfg.color}, 0 4px 20px rgba(0,0,0,0.07)` : undefined,
                  transform: isActive ? "translateY(-1px)" : undefined,
                }}
                onClick={() => setDrillCluster(prev => prev === lbl ? null : lbl)}>

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <p style={{ fontWeight: 800, fontSize: 12.5, color: isActive ? cfg.color : DS.text, lineHeight: 1.3 }}>{lbl}</p>
                  <span className={`badge ${cfg.badge}`} style={{ fontSize: 9, flexShrink: 0, marginLeft: 6 }}>{cfg.icon} {type}</span>
                </div>

                {/* KPI row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
                  <div style={{ background: "#f7f9fb", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                    <p style={{ fontSize: 9, color: DS.textMuted, fontWeight: 600 }}>Partners</p>
                    <p style={{ fontSize: 14, fontWeight: 800, color: DS.text, marginTop: 2 }}>{partnerCount}</p>
                  </div>
                  <div style={{ background: "#f7f9fb", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                    <p style={{ fontSize: 9, color: DS.textMuted, fontWeight: 600 }}>Avg Rev</p>
                    <p style={{ fontSize: 12, fontWeight: 800, color: DS.primary, marginTop: 2 }}>{fmt(avgRev)}</p>
                  </div>
                  <div style={{ background: "#f7f9fb", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                    <p style={{ fontSize: 9, color: DS.textMuted, fontWeight: 600 }}>Churn</p>
                    <p style={{ fontSize: 14, fontWeight: 800, color: churnRate > 0.4 ? DS.red : churnRate > 0.2 ? DS.amber : DS.green, marginTop: 2 }}>{(churnRate * 100).toFixed(0)}%</p>
                  </div>
                </div>

                {/* Revenue share mini-bar — always shown, even if 0 */}
                <RevenueBar pct={revShare} color={cfg.color} />

                {/* Visual mini bar vs others */}
                <div style={{ height: 4, background: "rgba(199,196,216,0.2)", borderRadius: 999, overflow: "hidden", marginTop: 4, position: "relative" }}>
                  <div style={{ position: "absolute", inset: 0, width: `${(revShare / totalRevShare) * 100}%`, background: `${cfg.color}60`, borderRadius: 999 }} />
                </div>

                {!!c.strategic_tag && (
                  <span style={{ display: "inline-block", marginTop: 8, fontSize: 9.5, background: "#f0f0ff", color: DS.primary, padding: "2px 8px", borderRadius: 999, fontWeight: 700 }}>
                    🏷 {String(c.strategic_tag)}
                  </span>
                )}

                {isActive && (
                  <p style={{ marginTop: 8, fontSize: 9.5, color: cfg.color, fontWeight: 700, letterSpacing: "0.04em" }}>▼ DRILLED IN — see partner table below</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Drilldown Partner Table ────────────────────────────────────────── */}
      {drillCluster && (
        <>
          <SectionLabel>🔍 Partner Drilldown — {drillCluster}</SectionLabel>
          <Panel style={{ marginBottom: 24 }}>
            <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid rgba(199,196,216,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, color: DS.text }}>{drillCluster}</p>
                <p style={{ fontSize: 11, color: DS.textMuted }}>{drillPartners.length} partners · click column header to sort</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="outline" size="sm" onClick={() => downloadCSV(drillPartners.map(p => ({
                  partner: p.partner_name, state: p.state, type: p.cluster_type,
                  revenue: p.z, strategic_tag: p.strategic_tag,
                })), `${drillCluster.replace(/\s/g, "_")}_partners.csv`)}>
                  <Download size={10} />Export
                </Btn>
                <Btn variant="ghost" size="sm" onClick={() => setDrillCluster(null)}><X size={10} />Close</Btn>
              </div>
            </div>
            {drillPartners.length === 0 ? (
              <EmptyState message="No scatter data for this cluster — scatter data may not be loaded yet." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      {[
                        { key: "partner_name", label: "Partner" },
                        { key: "state", label: "State" },
                        { key: "cluster_type", label: "Type" },
                        { key: "z", label: "Revenue" },
                        { key: "strategic_tag", label: "Tag" },
                      ].map(({ key, label }) => (
                        <th key={key} onClick={() => toggleSort(key)}
                          style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            {label}<SortIcon k={key} />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {drillPartners.map((p, i) => {
                      const tcfg = TYPE_CONFIG[p.cluster_type] ?? { color: DS.primary, badge: "badge-indigo", icon: null };
                      return (
                        <tr key={i}>
                          <td style={{ color: DS.textMuted, fontSize: 10, width: 28 }}>{i + 1}</td>
                          <td style={{ fontWeight: 700, color: DS.text }}>{p.partner_name || "—"}</td>
                          <td style={{ color: DS.textMuted }}>{p.state || "—"}</td>
                          <td><span className={`badge ${tcfg.badge}`} style={{ fontSize: 9 }}>{tcfg.icon} {p.cluster_type}</span></td>
                          <td style={{ fontWeight: 700, color: DS.primary }}>{fmt(p.z)}</td>
                          <td style={{ fontSize: 11, color: DS.textMuted, fontStyle: p.strategic_tag && p.strategic_tag !== "undefined" ? "normal" : "italic" }}>
                            {p.strategic_tag && p.strategic_tag !== "undefined" ? `🏷 ${p.strategic_tag}` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
