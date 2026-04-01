"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DS } from "@/lib/ds";
import { Panel, PanelHeader, SectionLabel, LoadingSkeleton, ErrorBanner, EmptyState, Btn } from "@/components/ui";
import { Activity, AlertTriangle, CheckCircle, Clock, Cpu, Database, RefreshCw, TrendingDown } from "lucide-react";

const TABS = ["System Health", "Realtime Queue", "Operational Alerts", "Cluster Quality", "Model Metrics"];

function StatusPill({ ok }: { ok: boolean }) {
  return <span className={`badge ${ok ? "badge-green" : "badge-red"}`} style={{ fontSize: 9 }}>{ok ? "✓ OK" : "✗ Issue"}</span>;
}

export default function MonitoringPage() {
  const [tab, setTab] = useState("System Health");
  const { data: snap, isLoading, error, refetch } = useQuery({ queryKey: ["mon-snap"], queryFn: api.monitoring.snapshot });
  const { data: alerts }         = useQuery({ queryKey: ["mon-alerts"], queryFn: () => api.monitoring.alerts(200) });
  const { data: clusterQuality } = useQuery({ queryKey: ["mon-cq"],     queryFn: api.monitoring.clusterQuality });
  const { data: realtimeStatus } = useQuery({ queryKey: ["mon-rt"],     queryFn: api.monitoring.realtimeStatus, refetchInterval: 15000 });
  const { data: dataQuality }    = useQuery({ queryKey: ["mon-dq"],     queryFn: api.monitoring.dataQuality });

  const snapData  = (snap   ?? {}) as Record<string, unknown>;
  const alertData = (alerts ?? {}) as Record<string, unknown>;
  const cqData    = (clusterQuality ?? {}) as Record<string, unknown>;
  const rtData    = (realtimeStatus ?? {}) as Record<string, unknown>;
  const dqData    = (dataQuality ?? {}) as Record<string, unknown>;

  const alertRows  = (alertData.alerts  as Record<string, unknown>[]) ?? [];
  const stepTimings = (snapData.step_timings as Record<string, unknown>[]) ?? [];

  // Config flags & model metrics
  const configFlags = (snapData.config_flags as Record<string, unknown>) ?? {};
  const churnModel  = (snapData.churn_model  ?? dqData.churn_model  ?? {}) as Record<string, unknown>;
  const creditModel = (snapData.credit_model ?? dqData.credit_model ?? {}) as Record<string, unknown>;
  const assocStats  = (snapData.assoc_stats  ?? dqData.assoc_stats  ?? {}) as Record<string, unknown>;

  if (isLoading) return <LoadingSkeleton lines={6} />;
  if (error)     return <ErrorBanner message="Failed to load monitoring data." />;

  return (
    <div style={{ animation: "fadeIn 0.25s ease-out" }}>
      <div className="page-hero" style={{ "--hero-accent": DS.red } as React.CSSProperties}>
        <span className="page-hero-icon"><Activity size={26} color={DS.red} /></span>
        <div>
          <div className="page-hero-title">System Monitoring</div>
          <div className="page-hero-sub">Real-time pipeline health · Model metrics · Cluster quality · Operational alerts</div>
        </div>
        <span style={{ marginLeft: "auto" }}>
          <Btn variant="outline" size="sm" onClick={() => refetch()}><RefreshCw size={11} />Refresh</Btn>
        </span>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Partners", key: "partner_count",  icon: <Database size={14} color={DS.blue}    />, color: DS.blue },
          { label: "ML Clusters",    key: "cluster_count",  icon: <Cpu size={14} color="#8b5cf6"          />, color: "#8b5cf6" },
          { label: "Assoc Rules",    key: "rule_count",     icon: <Activity size={14} color={DS.green}   />, color: DS.green },
          { label: "Active Alerts",  key: "alert_count",    icon: <AlertTriangle size={14} color={DS.red}/>, color: DS.red },
        ].map(({ label, key, icon, color }) => (
          <div key={key} className="metric-card">
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>{icon}<p className="kpi-label">{label}</p></div>
            <p className="kpi-val" style={{ color }}>{String(snapData[key] ?? alertRows.length)}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tab-list" style={{ marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t} className={`tab-item ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {/* === System Health === */}
      {tab === "System Health" && (
        <>
          {/* Config flags */}
          {Object.keys(configFlags).length > 0 && (
            <>
              <SectionLabel>Configuration Flags</SectionLabel>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                {Object.entries(configFlags).map(([k, v]) => (
                  <div key={k} className="card" style={{ padding: "10px 16px", display: "flex", gap: 8, alignItems: "center" }}>
                    <StatusPill ok={Boolean(v)} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{k.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Step timings */}
          {stepTimings.length > 0 && (
            <>
              <SectionLabel>Pipeline Step Latencies</SectionLabel>
              <Panel style={{ marginBottom: 18 }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead><tr><th>Step</th><th>Duration (s)</th><th>Status</th></tr></thead>
                    <tbody>
                      {stepTimings.map((s, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}><Clock size={11} style={{ display: "inline", marginRight: 5, color: DS.textMuted }} />{String(s.step ?? s.name ?? "")}</td>
                          <td style={{ fontFamily: "Manrope", fontWeight: 700, color: Number(s.duration_s ?? s.duration ?? 0) > 5 ? DS.amber : DS.green }}>{Number(s.duration_s ?? s.duration ?? 0).toFixed(2)}s</td>
                          <td><StatusPill ok={String(s.status ?? "ok").toLowerCase() === "ok"} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </>
          )}

          {/* Snapshot KVPs */}
          <SectionLabel>Snapshot Values</SectionLabel>
          <Panel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0 }}>
              {Object.entries(snapData)
                .filter(([k]) => !["step_timings", "config_flags", "churn_model", "credit_model", "assoc_stats"].includes(k))
                .filter(([, v]) => typeof v !== "object" || v === null)
                .map(([k, v], i) => (
                  <div key={k} style={{ padding: "10px 16px", borderRight: i % 3 < 2 ? "1px solid rgba(199,196,216,0.1)" : "none", borderBottom: "1px solid rgba(199,196,216,0.1)" }}>
                    <p style={{ fontSize: 10, color: DS.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{k.replace(/_/g, " ")}</p>
                    <p style={{ fontFamily: "Manrope", fontSize: 15, fontWeight: 800, color: DS.text }}>{String(v ?? "—")}</p>
                  </div>
                ))
              }
            </div>
          </Panel>
        </>
      )}

      {/* === Realtime Queue === */}
      {tab === "Realtime Queue" && (
        <>
          <SectionLabel>Real-Time Job Queue <span style={{ fontSize: 9, fontWeight: 500 }}>(auto-refreshes every 15s)</span></SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Pending",  key: "pending",  color: DS.amber },
              { label: "Running",  key: "running",  color: DS.blue },
              { label: "Scored",   key: "scored",   color: DS.green },
              { label: "Failed",   key: "failed",   color: DS.red },
            ].map(({ label, key, color }) => (
              <div key={key} className="metric-card">
                <p className="kpi-label">{label}</p>
                <p className="kpi-val" style={{ color }}>{String(rtData[key] ?? "—")}</p>
              </div>
            ))}
          </div>
          {Object.entries(rtData).filter(([, v]) => typeof v !== "object" || v === null).length > 4 && (
            <Panel>
              <div style={{ padding: "14px 16px" }}>
                {Object.entries(rtData)
                  .filter(([k]) => !["pending", "running", "scored", "failed"].includes(k))
                  .filter(([, v]) => typeof v !== "object")
                  .map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0", borderBottom: "1px solid rgba(199,196,216,0.1)" }}>
                      <span style={{ color: DS.textMuted }}>{k.replace(/_/g, " ")}</span>
                      <span style={{ fontWeight: 700 }}>{String(v)}</span>
                    </div>
                  ))}
              </div>
            </Panel>
          )}
        </>
      )}

      {/* === Operational Alerts === */}
      {tab === "Operational Alerts" && (
        <Panel>
          <PanelHeader title="Operational Alerts" sub={`${alertRows.length} active`} />
          <div style={{ overflowX: "auto", maxHeight: 520, overflowY: "auto" }}>
            <table className="data-table">
              <thead><tr>
                <th>Partner</th><th>State</th><th>Revenue Drop</th><th>Churn Risk</th><th>Credit Band</th><th>Triggered Rules</th>
              </tr></thead>
              <tbody>
                {alertRows.map((a, i) => {
                  const churn = Number(a.churn_probability ?? 0);
                  const drop = Number(a.revenue_drop_pct ?? 0);
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 700 }}>{String(a.partner_name ?? a.partner ?? "")}</td>
                      <td style={{ color: DS.textMuted }}>{String(a.state ?? "")}</td>
                      <td style={{ color: drop > 10 ? DS.red : DS.amber, fontWeight: 700 }}>{drop.toFixed(1)}%</td>
                      <td><span className={`badge ${churn > 0.65 ? "badge-red" : churn > 0.35 ? "badge-amber" : "badge-green"}`}>{(churn * 100).toFixed(1)}%</span></td>
                      <td><span className={`badge ${String(a.credit_risk_band ?? "").toLowerCase() === "high" ? "badge-red" : String(a.credit_risk_band ?? "").toLowerCase() === "medium" ? "badge-amber" : "badge-green"}`}>{String(a.credit_risk_band ?? "—")}</span></td>
                      <td style={{ fontSize: 10, color: DS.textMuted, maxWidth: 200, whiteSpace: "pre-wrap" }}>{String(a.triggered_rules ?? "")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {alertRows.length === 0 && <EmptyState message="No active alerts." />}
        </Panel>
      )}

      {/* === Cluster Quality === */}
      {tab === "Cluster Quality" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Silhouette",   key: "silhouette_score",   fmt: (v: unknown) => Number(v).toFixed(4) },
              { label: "Outlier Ratio",key: "outlier_ratio",      fmt: (v: unknown) => `${(Number(v)*100).toFixed(1)}%` },
              { label: "Entropy",      key: "cluster_entropy",    fmt: (v: unknown) => Number(v).toFixed(3) },
              { label: "Num Clusters", key: "num_clusters",       fmt: (v: unknown) => String(v ?? "—") },
            ].map(({ label, key, fmt: fmtFn }) => (
              <div key={key} className="metric-card">
                <p className="kpi-label">{label}</p>
                <p className="kpi-val" style={{ fontSize: "1.5rem" }}>{cqData[key] !== undefined ? fmtFn(cqData[key]) : "—"}</p>
              </div>
            ))}
          </div>
          {cqData.vip_summary && (
            <Panel style={{ marginBottom: 14 }}>
              <PanelHeader title="VIP Cluster" sub="High-value segment summary" />
              <div style={{ padding: "14px 16px", fontSize: 12.5, color: DS.textMuted }}>{JSON.stringify(cqData.vip_summary, null, 2)}</div>
            </Panel>
          )}
          {cqData.growth_summary && (
            <Panel style={{ marginBottom: 14 }}>
              <PanelHeader title="Growth Cluster" sub="Emerging partner pool" />
              <div style={{ padding: "14px 16px", fontSize: 12.5, color: DS.textMuted }}>{JSON.stringify(cqData.growth_summary, null, 2)}</div>
            </Panel>
          )}
          {Object.entries(cqData).filter(([k]) => !["silhouette_score","outlier_ratio","cluster_entropy","num_clusters","vip_summary","growth_summary"].includes(k)).filter(([,v]) => typeof v !== "object").map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "8px 16px", borderBottom: "1px solid rgba(199,196,216,0.08)", background: "#fff", borderRadius: 8, marginBottom: 4 }}>
              <span style={{ color: DS.textMuted }}>{k.replace(/_/g, " ")}</span>
              <span style={{ fontWeight: 700 }}>{String(v)}</span>
            </div>
          ))}
          {Object.keys(cqData).length === 0 && <EmptyState message="Cluster quality data not available." />}
        </>
      )}

      {/* === Model Metrics === */}
      {tab === "Model Metrics" && (
        <>
          {/* Churn model */}
          <SectionLabel>Churn Model Performance</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
            {[
              { label: "ROC-AUC",        key: "roc_auc",         fmt: (v: unknown) => Number(v).toFixed(4) },
              { label: "Avg Precision",  key: "avg_precision",   fmt: (v: unknown) => Number(v).toFixed(4) },
              { label: "Train Samples",  key: "train_samples",   fmt: (v: unknown) => String(v) },
              { label: "Valid Samples",  key: "valid_samples",   fmt: (v: unknown) => String(v) },
            ].map(({ label, key, fmt: fmtFn }) => (
              <div key={key} className="metric-card">
                <p className="kpi-label">{label}</p>
                <p className="kpi-val" style={{ fontSize: "1.4rem", color: DS.green }}>{churnModel[key] !== undefined ? fmtFn(churnModel[key]) : "—"}</p>
              </div>
            ))}
          </div>

          {/* Credit risk */}
          <SectionLabel>Credit Risk Model</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
            {[
              { label: "Partners Covered",  key: "covered_partners", fmt: (v: unknown) => String(v) },
              { label: "High Risk Count",   key: "high_risk_count",  fmt: (v: unknown) => String(v) },
              { label: "Avg Credit Score",  key: "avg_credit_score", fmt: (v: unknown) => Number(v).toFixed(3) },
              { label: "Coverage %",        key: "coverage_pct",     fmt: (v: unknown) => `${Number(v).toFixed(1)}%` },
            ].map(({ label, key, fmt: fmtFn }) => (
              <div key={key} className="metric-card">
                <p className="kpi-label">{label}</p>
                <p className="kpi-val" style={{ fontSize: "1.4rem", color: DS.amber }}>{creditModel[key] !== undefined ? fmtFn(creditModel[key]) : "—"}</p>
              </div>
            ))}
          </div>

          {/* Association stats */}
          <SectionLabel>Association Rule Reliability</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 18 }}>
            {[
              { label: "Total Rules",       key: "total_rules",       color: DS.primary },
              { label: "Low Support Rules", key: "low_support_count", color: DS.amber },
              { label: "High Strength",     key: "high_strength_count",color: DS.green },
            ].map(({ label, key, color }) => (
              <div key={key} className="metric-card">
                <p className="kpi-label">{label}</p>
                <p className="kpi-val" style={{ color }}>{String(assocStats[key] ?? "—")}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
