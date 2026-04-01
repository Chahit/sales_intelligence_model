"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DS } from "@/lib/ds";
import { Panel, PanelHeader, SectionLabel, LoadingSkeleton, ErrorBanner, EmptyState } from "@/components/ui";
import {
  AreaChart, Area, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell, ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Trophy, Users, DollarSign, AlertCircle } from "lucide-react";

const TT = { background: "#fff", border: "1px solid rgba(199,196,216,0.3)", borderRadius: 10, fontSize: 11 };

function fmt(v: unknown): string {
  const n = Number(v);
  if (!v && v !== 0) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toFixed(0)}`;
}

function initials(name: string) { return name.split(" ").map(p => p[0] ?? "").join("").slice(0, 2).toUpperCase(); }
const PALETTE = ["#4F46E5","#8b5cf6","#06b6d4","#f59e0b","#10b981","#ef4444","#3b82f6","#ec4899"];

const TABS = ["Leaderboard", "Expense vs Revenue", "Partner Coverage", "Issues vs Orders", "Revenue Efficiency", "Individual Drilldown"];

export default function SalesRepPage() {
  const [tab, setTab] = useState("Leaderboard");
  const [drillRep, setDrillRep] = useState<Record<string, unknown> | null>(null);

  const { data: lbData, isLoading, error } = useQuery({ queryKey: ["sr-leaderboard"], queryFn: api.salesRep.leaderboard });
  const { data: monthlyData } = useQuery({
    queryKey: ["sr-monthly", drillRep?.rep_id],
    queryFn: () => api.salesRep.monthlyRevenue(Number(drillRep?.rep_id)),
    enabled: !!drillRep?.rep_id,
  });

  const reps = (lbData?.rows ?? []) as Record<string, unknown>[];
  const monthlyRows = (monthlyData?.rows ?? []) as Record<string, unknown>[];

  const totalRev = reps.reduce((s, r) => s + Number(r.total_revenue ?? 0), 0);
  const totalExpenses = reps.reduce((s, r) => s + Number(r.total_expenses ?? r.total_cost ?? 0), 0);
  const avgROI = reps.length ? reps.reduce((s, r) => s + Number(r.roi ?? 0), 0) / reps.length : 0;
  const totalOrders = reps.reduce((s, r) => s + Number(r.total_orders ?? 0), 0);
  const totalIssues = reps.reduce((s, r) => s + Number(r.total_issues ?? 0), 0);
  const totalPartners = reps.reduce((s, r) => s + Number(r.unique_partners ?? r.partner_count ?? 0), 0);

  // Expense vs Revenue scatter data
  const scatterData = reps.map(r => ({
    name: String(r.rep_name ?? r.name ?? ""),
    x: Number(r.total_expenses ?? r.total_cost ?? 0),
    y: Number(r.total_revenue ?? 0),
    z: Number(r.unique_customers ?? r.unique_partners ?? r.partner_count ?? 10),
  }));

  // Issues vs Orders bar data
  const issuesData = reps.map(r => ({
    name: String(r.rep_name ?? r.name ?? "").split(" ")[0],
    Issues: Number(r.total_issues ?? 0),
    Orders: Number(r.total_orders ?? 0),
  }));

  // Revenue efficiency
  const efficiencyData = reps.map(r => ({
    name: String(r.rep_name ?? r.name ?? ""),
    revPerOrder:   r.total_orders ? Number(r.total_revenue ?? 0) / Number(r.total_orders) : 0,
    revPerPartner: r.unique_partners ? Number(r.total_revenue ?? 0) / Number(r.unique_partners ?? r.partner_count ?? 1) : 0,
    costPerOrder:  r.total_orders ? Number(r.total_expenses ?? 0) / Number(r.total_orders) : 0,
  }));

  // Partner coverage bar
  const coverageData = reps.map(r => ({
    name: String(r.rep_name ?? r.name ?? "").split(" ")[0],
    Partners: Number(r.unique_partners ?? r.partner_count ?? 0),
    Customers: Number(r.unique_customers ?? 0),
  }));

  // Individual drilldown: add ±15% forecast cone
  const drillChartData = monthlyRows.map((r, i) => {
    const revenue = Number(r.revenue ?? 0);
    const isForecast = i >= monthlyRows.length - 3;
    return {
      month: String(r.month ?? ""),
      revenue: isForecast ? null : revenue,
      forecast: isForecast ? revenue : null,
      forecastHigh: isForecast ? revenue * 1.15 : null,
      forecastLow:  isForecast ? revenue * 0.85 : null,
    };
  });

  if (isLoading) return <LoadingSkeleton lines={6} />;
  if (error)    return <ErrorBanner message="Failed to load sales rep data." />;

  return (
    <div style={{ animation: "fadeIn 0.25s ease-out" }}>
      <div className="page-hero" style={{ "--hero-accent": DS.green } as React.CSSProperties}>
        <span className="page-hero-icon">👔</span>
        <div>
          <div className="page-hero-title">Sales Rep Performance</div>
          <div className="page-hero-sub">Territory analytics · Expense ROI · Partner coverage · Revenue efficiency · Individual forecasts</div>
        </div>
      </div>

      {/* Team KPI strip */}
      <SectionLabel>Team Overview</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Team Revenue",   value: fmt(totalRev),         icon: <DollarSign size={14} color={DS.green} />,   color: DS.green },
          { label: "Total Expenses", value: fmt(totalExpenses),    icon: <DollarSign size={14} color={DS.amber} />,   color: DS.amber },
          { label: "Avg ROI",        value: `${avgROI.toFixed(1)}%`, icon: <TrendingUp size={14} color={DS.primary} />, color: DS.primary },
          { label: "Total Orders",   value: totalOrders.toFixed(0), icon: <Trophy size={14} color="#8b5cf6" />,        color: "#8b5cf6" },
          { label: "Partner Reach",  value: totalPartners.toFixed(0),icon: <Users size={14} color={DS.blue} />,       color: DS.blue },
          { label: "Total Issues",   value: totalIssues.toFixed(0), icon: <AlertCircle size={14} color={DS.red} />,   color: DS.red },
        ].map(({ label, value, icon, color }) => (
          <div className="metric-card" key={label} style={{ padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>{icon}<p className="kpi-label">{label}</p></div>
            <p className="kpi-val" style={{ color, fontSize: "1.4rem" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tab list */}
      <div className="tab-list" style={{ marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t} className={`tab-item ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {/* === Leaderboard === */}
      {tab === "Leaderboard" && (
        <Panel>
          <PanelHeader title="Rep Leaderboard" sub={`${reps.length} sales reps`} />
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr><th>#</th><th>Rep</th><th>Revenue</th><th>Quota</th><th>Attainment</th><th>Orders</th><th>Partners</th><th>Expenses</th><th>ROI</th><th>Issues</th><th>Action</th></tr></thead>
              <tbody>
                {reps.map((r, i) => {
                  const quota = Number(r.quota ?? 0);
                  const revenue = Number(r.total_revenue ?? 0);
                  const attainment = quota > 0 ? (revenue / quota) * 100 : 0;
                  const isAtRisk = attainment < 70;
                  const color = PALETTE[i % PALETTE.length];
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 800, color: i === 0 ? "#f59e0b" : DS.textMuted }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                            {initials(String(r.rep_name ?? r.name ?? "?"))}
                          </div>
                          <div>
                            <p style={{ fontWeight: 700, fontSize: 12 }}>{String(r.rep_name ?? r.name ?? "")}</p>
                            <p style={{ fontSize: 10, color: DS.textMuted }}>{String(r.territory ?? r.state ?? "")}</p>
                          </div>
                          {isAtRisk && <span className="badge badge-amber" style={{ fontSize: 9 }}><AlertCircle size={8} /> At Risk</span>}
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, color: DS.green }}>{fmt(r.total_revenue)}</td>
                      <td style={{ color: DS.textMuted }}>{fmt(r.quota)}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 700, color: isAtRisk ? DS.red : DS.green, fontSize: 12 }}>{attainment.toFixed(0)}%</span>
                          <div style={{ width: 60, height: 4, background: "#e6e8ea", borderRadius: 999 }}>
                            <div style={{ width: `${Math.min(100, attainment)}%`, height: "100%", background: isAtRisk ? DS.red : DS.green, borderRadius: 999 }} />
                          </div>
                        </div>
                      </td>
                      <td>{String(r.total_orders ?? "—")}</td>
                      <td>{String(r.unique_partners ?? r.partner_count ?? "—")}</td>
                      <td style={{ color: DS.amber }}>{fmt(r.total_expenses ?? r.total_cost)}</td>
                      <td style={{ fontWeight: 600, color: Number(r.roi ?? 0) >= 2 ? DS.green : DS.amber }}>{r.roi !== undefined ? `${Number(r.roi).toFixed(1)}×` : "—"}</td>
                      <td style={{ color: Number(r.total_issues ?? 0) > 10 ? DS.red : DS.textMuted }}>{String(r.total_issues ?? 0)}</td>
                      <td><button className="btn btn-ghost" style={{ fontSize: 10, padding: "4px 8px" }} onClick={() => { setDrillRep(r); setTab("Individual Drilldown"); }}>Drill →</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* === Expense vs Revenue === */}
      {tab === "Expense vs Revenue" && (
        <Panel>
          <PanelHeader title="Expense vs Revenue Scatter" sub="Bubble size = unique customers" />
          <div style={{ padding: "8px 4px 12px" }}>
            <ResponsiveContainer width="100%" height={380}>
              <ScatterChart margin={{ left: 50, right: 20, top: 10, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(199,196,216,0.15)" />
                <XAxis dataKey="x" type="number" name="Expenses" label={{ value: "Total Expenses (₹)", position: "insideBottom", offset: -10, fontSize: 10 }} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
                <YAxis dataKey="y" type="number" name="Revenue" label={{ value: "Revenue (₹)", angle: -90, position: "insideLeft", fontSize: 10 }} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
                <ZAxis dataKey="z" range={[40, 300]} />
                <Tooltip contentStyle={TT} content={({ payload }) => {
                  if (!payload?.length) return null;
                  const p = payload[0].payload as typeof scatterData[0];
                  return (
                    <div style={{ background: "#fff", border: "1px solid rgba(199,196,216,0.3)", borderRadius: 10, padding: "10px 14px", fontSize: 11 }}>
                      <p style={{ fontWeight: 700 }}>{p.name}</p>
                      <p>Revenue: <b style={{ color: DS.green }}>{fmt(p.y)}</b></p>
                      <p>Expenses: <b style={{ color: DS.amber }}>{fmt(p.x)}</b></p>
                      <p>Customers: {p.z}</p>
                    </div>
                  );
                }} />
                <Scatter data={scatterData}>
                  {scatterData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.75} />)}
                </Scatter>
                <ReferenceLine x={totalExpenses / reps.length} stroke="rgba(199,196,216,0.6)" strokeDasharray="4 4" label={{ value: "Avg Expense", position: "insideTop", fontSize: 9 }} />
                <ReferenceLine y={totalRev / reps.length} stroke="rgba(199,196,216,0.6)" strokeDasharray="4 4" label={{ value: "Avg Revenue", position: "insideRight", fontSize: 9 }} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {/* === Partner Coverage === */}
      {tab === "Partner Coverage" && (
        <Panel>
          <PanelHeader title="Partner & Customer Coverage by Rep" sub="Horizontal bar comparison" />
          <div style={{ padding: "8px 4px 12px" }}>
            <ResponsiveContainer width="100%" height={Math.max(300, reps.length * 55)}>
              <BarChart data={coverageData} layout="vertical" margin={{ left: 100, right: 30, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(199,196,216,0.15)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={95} />
                <Tooltip contentStyle={TT} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Partners" fill={DS.primary} radius={[0,4,4,0]} />
                <Bar dataKey="Customers" fill="#8b5cf6" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {/* === Issues vs Orders === */}
      {tab === "Issues vs Orders" && (
        <Panel>
          <PanelHeader title="Customer Issues vs Orders" sub="Service quality benchmarking" />
          <div style={{ padding: "8px 4px 12px" }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={issuesData} margin={{ left: 10, right: 20, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(199,196,216,0.15)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TT} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Orders" fill={DS.green} radius={[4,4,0,0]} />
                <Bar dataKey="Issues" fill={DS.red} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {/* === Revenue Efficiency === */}
      {tab === "Revenue Efficiency" && (
        <>
          <Panel>
            <PanelHeader title="Revenue Efficiency Table" sub="Rev/Order, Rev/Partner, Cost/Order" />
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead><tr><th>Rep</th><th>Revenue/Order</th><th>Revenue/Partner</th><th>Cost/Order</th></tr></thead>
                <tbody>
                  {efficiencyData.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700 }}>{r.name}</td>
                      <td style={{ color: DS.green, fontWeight: 700 }}>{fmt(r.revPerOrder)}</td>
                      <td style={{ color: DS.primary, fontWeight: 700 }}>{fmt(r.revPerPartner)}</td>
                      <td style={{ color: DS.amber }}>{fmt(r.costPerOrder)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel style={{ marginTop: 16 }}>
            <PanelHeader title="Rev/Order vs Cost/Order" sub="Higher Rev/Order with lower Cost/Order is ideal" />
            <div style={{ padding: "8px 4px 12px" }}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={efficiencyData.map(r => ({ name: r.name.split(" ")[0], "Rev/Order": Math.round(r.revPerOrder), "Cost/Order": Math.round(r.costPerOrder) }))} margin={{ left: 40, right: 10, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(199,196,216,0.15)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={TT} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Rev/Order" fill={DS.green} radius={[4,4,0,0]} />
                  <Bar dataKey="Cost/Order" fill={DS.amber} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </>
      )}

      {/* === Individual Drilldown === */}
      {tab === "Individual Drilldown" && (
        <>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.textMuted, marginBottom: 6 }}>Select Rep</p>
            <select className="form-select" style={{ maxWidth: 320 }} value={String(drillRep?.rep_id ?? "")} onChange={e => setDrillRep(reps.find(r => String(r.rep_id) === e.target.value) ?? null)}>
              <option value="">Choose rep…</option>
              {reps.map((r, i) => <option key={i} value={String(r.rep_id ?? "")}>{String(r.rep_name ?? r.name ?? `Rep ${i + 1}`)}</option>)}
            </select>
          </div>

          {drillRep && (
            <>
              {/* Rep profile card */}
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, alignItems: "center", marginBottom: 20, padding: "16px 20px", background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(25,28,30,0.05)" }}>
                <div style={{ width: 50, height: 50, borderRadius: "50%", background: PALETTE[reps.indexOf(drillRep) % PALETTE.length], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16, fontWeight: 800 }}>
                  {initials(String(drillRep.rep_name ?? drillRep.name ?? "?"))}
                </div>
                <div>
                  <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 15 }}>{String(drillRep.rep_name ?? drillRep.name ?? "")}</p>
                  <div style={{ display: "flex", gap: 12, fontSize: 11, color: DS.textMuted, marginTop: 4, flexWrap: "wrap" }}>
                    <span>Territory: {String(drillRep.territory ?? drillRep.state ?? "—")}</span>
                    <span>Revenue: <b style={{ color: DS.green }}>{fmt(drillRep.total_revenue)}</b></span>
                    <span>Quota: {fmt(drillRep.quota)}</span>
                    <span>Orders: {String(drillRep.total_orders ?? "—")}</span>
                  </div>
                </div>
              </div>

              {/* Actual vs Forecast Chart */}
              <Panel style={{ marginBottom: 16 }}>
                <PanelHeader title="Revenue Trend — Actual vs Forecast (±15%)" sub="Last 3 months are projected" />
                <div style={{ padding: "8px 4px 16px" }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={drillChartData} margin={{ left: 50, right: 15, top: 8, bottom: 4 }}>
                      <defs>
                        <linearGradient id="drillGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={DS.primary} stopOpacity={0.15} />
                          <stop offset="100%" stopColor={DS.primary} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={DS.amber} stopOpacity={0.12} />
                          <stop offset="100%" stopColor={DS.amber} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(199,196,216,0.15)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
                      <Tooltip contentStyle={TT} />
                      <Area type="monotone" dataKey="revenue"      stroke={DS.primary} strokeWidth={2.5} fill="url(#drillGrad)" dot={false} />
                      <Area type="monotone" dataKey="forecast"     stroke={DS.amber} strokeWidth={2} strokeDasharray="5 5" fill="url(#fcGrad)" dot={false} />
                      <Area type="monotone" dataKey="forecastHigh" stroke="transparent" fill={DS.amber} fillOpacity={0.06} />
                      <Area type="monotone" dataKey="forecastLow"  stroke="transparent" fill="white" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              {/* MoM delta table */}
              {monthlyRows.length > 0 && (
                <Panel>
                  <PanelHeader title="Month-over-Month Revenue Delta" sub={drillRep.rep_name as string} />
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table">
                      <thead><tr><th>Month</th><th>Revenue</th><th>MoM Change</th><th>MoM %</th></tr></thead>
                      <tbody>
                        {monthlyRows.map((r, i) => {
                          const rev = Number(r.revenue ?? 0);
                          const prev = i > 0 ? Number(monthlyRows[i - 1].revenue ?? 0) : rev;
                          const delta = rev - prev;
                          const pct = prev ? (delta / prev) * 100 : 0;
                          return (
                            <tr key={i}>
                              <td style={{ fontWeight: 600 }}>{String(r.month ?? "")}</td>
                              <td style={{ fontWeight: 700 }}>{fmt(rev)}</td>
                              <td style={{ color: delta >= 0 ? DS.green : DS.red, fontWeight: 700 }}>
                                {delta >= 0 ? <TrendingUp size={10} style={{ display: "inline" }} /> : <TrendingDown size={10} style={{ display: "inline" }} />} {fmt(Math.abs(delta))}
                              </td>
                              <td style={{ color: pct >= 0 ? DS.green : DS.red }}>{i === 0 ? "—" : `${pct.toFixed(1)}%`}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              )}
            </>
          )}
          {!drillRep && <EmptyState message="Select a rep to see their individual performance drilldown." />}
        </>
      )}
    </div>
  );
}
