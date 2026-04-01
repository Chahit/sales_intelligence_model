"use client";
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DS } from "@/lib/ds";
import { PageHeader, Panel, PanelHeader, SectionLabel, LoadingSkeleton, ErrorBanner, EmptyState, Btn } from "@/components/ui";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Search, Package, Users, TrendingUp, Zap, BarChart2 } from "lucide-react";

const TT = { background: "#fff", border: "1px solid rgba(199,196,216,0.3)", borderRadius: 10, fontSize: 11, boxShadow: "0 8px 24px rgba(25,28,30,0.08)" };

function fmt(v: unknown): string {
  const n = Number(v);
  if (!v && v !== 0) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toFixed(0)}`;
}

const TABS = ["All Rules", "Bundle Simulator", "Partner Cross-Sell", "Sequential Patterns", "Cross-Category Upgrades"];

type TabKey = typeof TABS[number];

export default function MarketBasketPage() {
  const [tab, setTab] = useState<TabKey>("All Rules");
  const [minConf, setMinConf] = useState(0.15);
  const [minLift, setMinLift] = useState(1.0);
  const [minSupp, setMinSupp] = useState(5);
  const [search, setSearch] = useState("");
  const [bundleProduct, setBundleProduct] = useState("");
  const [partnerName, setPartnerName] = useState("");

  const { data: rulesData, isLoading, error } = useQuery({
    queryKey: ["mb-rules", minConf, minLift, minSupp, search],
    queryFn: () => api.marketBasket.rules({ min_confidence: minConf, min_lift: minLift, min_support: minSupp, search: search || undefined }),
  });

  const { data: bundleData, isFetching: bundleLoading } = useQuery({
    queryKey: ["mb-bundle", bundleProduct],
    queryFn: () => api.marketBasket.crossSell(bundleProduct, 5),
    enabled: !!bundleProduct,
  });

  const { data: partnerRecsData, isFetching: partnerLoading } = useQuery({
    queryKey: ["mb-partner", partnerName, minConf, minLift, minSupp],
    queryFn: () => api.marketBasket.partnerRecs(partnerName, { min_confidence: minConf, min_lift: minLift, min_support: minSupp, top_n: 20 }),
    enabled: !!partnerName,
  });

  const rows = (rulesData?.rows ?? []) as Record<string, unknown>[];
  const bundleRows = (bundleData?.rows ?? []) as Record<string, unknown>[];
  const partnerRows = (partnerRecsData?.rows ?? []) as Record<string, unknown>[];

  // All unique products from rules
  const products = Array.from(new Set(rows.map(r => String(r.product_a ?? r.item_a ?? "")).filter(Boolean))).sort();

  // Script helpers
  const buildScript = (rule: Record<string, unknown>, variant: "open" | "followup" | "value") => {
    const a = String(rule.product_a ?? rule.item_a ?? "Product A");
    const b = String(rule.product_b ?? rule.item_b ?? "Product B");
    const conf = (Number(rule.confidence_a_to_b ?? rule.confidence ?? 0) * 100).toFixed(0);
    const lift = Number(rule.lift_a_to_b ?? rule.lift ?? 0).toFixed(1);
    if (variant === "open")    return `"You've been a great buyer of ${a}. ${conf}% of distributors who buy ${a} also stock ${b}. Want me to set up a trial order?"`;
    if (variant === "followup") return `"Following up on that ${b} opportunity — partners with similar profiles see a ${lift}x revenue lift when they add it to their portfolio."`;
    return `"Think of ${b} as a value extension of ${a}. Margins are stronger and it handles adjacent customer demand your competitors probably aren't capturing yet."`;
  };

  const topRulesForChart = rows.slice(0, 10).map(r => ({
    name: `${String(r.product_a ?? r.item_a ?? "").slice(0, 15)}→${String(r.product_b ?? r.item_b ?? "").slice(0, 12)}`,
    lift: Number(r.lift_a_to_b ?? r.lift ?? 0),
    conf: Number(r.confidence_a_to_b ?? r.confidence ?? 0),
    revenue_gain: Number(r.expected_revenue_gain ?? r.revenue_gain ?? 0),
  }));

  return (
    <div style={{ animation: "fadeIn 0.25s ease-out" }}>
      <div className="page-hero" style={{ "--hero-accent": "#8b5cf6" } as React.CSSProperties}>
        <span className="page-hero-icon">🛒</span>
        <div>
          <div className="page-hero-title">Market Basket Intelligence</div>
          <div className="page-hero-sub">FP-Growth · Temporal Decay · Sequential · Cross-Category — discover hidden bundle and cross-sell opportunities.</div>
        </div>
      </div>

      {/* Algorithm info strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 18 }}>
        {[
          { label: "FP-Growth", desc: "Frequent itemsets", color: DS.primary },
          { label: "Temporal Decay", desc: "Recency-weighted pairs", color: "#8b5cf6" },
          { label: "Sequential", desc: "A → then B (time-aware)", color: "#06b6d4" },
          { label: "Cross-Category", desc: "Diverse expansion pairs", color: "#f59e0b" },
        ].map(({ label, desc, color }) => (
          <div key={label} className="card" style={{ padding: "10px 14px", borderLeft: `3px solid ${color}` }}>
            <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color }}>{label}</p>
            <p style={{ fontSize: 11, color: DS.textMuted, marginTop: 2 }}>{desc}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <Panel style={{ marginBottom: 18 }}>
        <div style={{ padding: "14px 18px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.5fr", gap: 16, alignItems: "end" }}>
            <div>
              <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.textMuted, marginBottom: 6 }}>Min Confidence: {(minConf * 100).toFixed(0)}%</p>
              <input type="range" min={0} max={1} step={0.01} value={minConf} onChange={e => setMinConf(Number(e.target.value))} />
            </div>
            <div>
              <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.textMuted, marginBottom: 6 }}>Min Lift: {minLift.toFixed(1)}</p>
              <input type="range" min={0.5} max={10} step={0.1} value={minLift} onChange={e => setMinLift(Number(e.target.value))} />
            </div>
            <div>
              <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.textMuted, marginBottom: 6 }}>Min Support: {minSupp}</p>
              <input type="range" min={1} max={50} step={1} value={minSupp} onChange={e => setMinSupp(Number(e.target.value))} />
            </div>
            <div style={{ position: "relative" }}>
              <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: DS.textMuted }} />
              <input className="form-input" style={{ paddingLeft: 28 }} placeholder="Search product…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
      </Panel>

      {/* Tab list */}
      <div className="tab-list" style={{ marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t} className={`tab-item ${tab === t ? "active" : ""}`} onClick={() => setTab(t as TabKey)}>{t}</button>
        ))}
      </div>

      {/* === TAB: All Rules === */}
      {tab === "All Rules" && (
        <>
          {isLoading && <LoadingSkeleton lines={5} />}
          {error && <ErrorBanner message="Could not load association rules." />}
          {!isLoading && !error && (
            <>
              {/* Revenue gain chart */}
              {topRulesForChart.length > 0 && (
                <Panel style={{ marginBottom: 20 }}>
                  <PanelHeader title="Top 10 Rules by Lift" sub={`${rulesData?.total ?? 0} total rules`} />
                  <div style={{ padding: "8px 4px 12px" }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={topRulesForChart} margin={{ left: 40, right: 10, top: 8, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(199,196,216,0.2)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 8 }} angle={-35} textAnchor="end" axisLine={false} tickLine={false} interval={0} />
                        <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={TT} />
                        <Bar dataKey="lift" radius={[5,5,0,0]}>
                          {topRulesForChart.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? DS.primary : "#8b5cf6"} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              )}

              <Panel>
                <PanelHeader title="Association Rules" sub={`${rulesData?.total ?? 0} rules match filters`} />
                <div style={{ overflowX: "auto", maxHeight: 450, overflowY: "auto" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>If Buying…</th><th>→ Suggest</th><th>Conf</th><th>Lift</th><th>Support</th>
                        <th>Rev Gain (Wk)</th><th>Rev Gain (Mo)</th><th>Rev Gain (Yr)</th><th>Margin</th><th>Opening Script</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const conf = Number(r.confidence_a_to_b ?? r.confidence ?? 0);
                        const lift = Number(r.lift_a_to_b ?? r.lift ?? 0);
                        const strength = conf > 0.6 && lift > 3 ? { label: "Strong", cls: "badge-green" } : conf > 0.4 && lift > 2 ? { label: "Good", cls: "badge-blue" } : { label: "Weak", cls: "badge-gray" };
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 600, maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{String(r.product_a ?? r.item_a ?? "")}</td>
                            <td style={{ maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{String(r.product_b ?? r.item_b ?? "")}</td>
                            <td><span className={`badge ${strength.cls}`}>{strength.label} {(conf * 100).toFixed(0)}%</span></td>
                            <td style={{ fontWeight: 700, color: lift >= 2 ? DS.green : DS.textMuted }}>{lift.toFixed(2)}×</td>
                            <td style={{ color: DS.textMuted }}>{String(r.support_a ?? r.support ?? "—")}</td>
                            <td>{fmt(r.expected_gain_weekly ?? r.revenue_gain_weekly)}</td>
                            <td>{fmt(r.expected_gain_monthly ?? r.revenue_gain)}</td>
                            <td>{fmt(r.expected_gain_yearly ?? r.revenue_gain_yearly)}</td>
                            <td style={{ color: DS.green }}>{r.expected_margin_monthly ? fmt(r.expected_margin_monthly) : "—"}</td>
                            <td style={{ maxWidth: 240, fontSize: 10, color: DS.textMuted, fontStyle: "italic" }}>{buildScript(r, "open")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {rows.length === 0 && <EmptyState message="No rules match current filters." />}
              </Panel>
            </>
          )}
        </>
      )}

      {/* === TAB: Bundle Simulator === */}
      {tab === "Bundle Simulator" && (
        <>
          <SectionLabel>Pick a Base Product — See Top Bundle Partners</SectionLabel>
          <Panel style={{ marginBottom: 18 }}>
            <div style={{ padding: "14px 18px", display: "flex", gap: 12, alignItems: "center" }}>
              <select className="form-select" style={{ maxWidth: 340 }} value={bundleProduct} onChange={e => setBundleProduct(e.target.value)}>
                <option value="">Select base product…</option>
                {products.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {bundleLoading && <span style={{ fontSize: 11, color: DS.textMuted }}>Loading…</span>}
            </div>
          </Panel>
          {bundleProduct && bundleRows.length > 0 && (
            <>
              <SectionLabel>Top 5 Bundle Recommendations for "{bundleProduct}"</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
                {bundleRows.slice(0, 5).map((r, i) => {
                  const conf = Number(r.confidence_a_to_b ?? r.confidence ?? 0);
                  const lift = Number(r.lift_a_to_b ?? r.lift ?? 0);
                  const gain = Number(r.expected_gain_monthly ?? r.revenue_gain ?? 0);
                  return (
                    <div key={i} className="bundle-card">
                      <Package size={20} style={{ color: DS.primary, marginBottom: 8 }} />
                      <p style={{ fontWeight: 700, fontSize: 11.5, color: DS.text, marginBottom: 8, lineHeight: 1.4 }}>{String(r.product_b ?? r.item_b ?? "")}</p>
                      <p style={{ fontSize: 10, color: DS.textMuted }}>Confidence</p>
                      <p style={{ fontSize: 14, fontWeight: 800, fontFamily: "Manrope, sans-serif", color: DS.primary }}>{(conf * 100).toFixed(0)}%</p>
                      <p style={{ fontSize: 10, color: DS.textMuted, marginTop: 4 }}>Lift</p>
                      <p style={{ fontSize: 14, fontWeight: 800, fontFamily: "Manrope, sans-serif", color: DS.green }}>{lift.toFixed(2)}×</p>
                      {gain > 0 && <p style={{ fontSize: 10, color: DS.textMuted, marginTop: 6 }}>Monthly Gain: <b style={{ color: DS.green }}>{fmt(gain)}</b></p>}
                    </div>
                  );
                })}
              </div>

              {/* Scripts for bundle */}
              <SectionLabel>Sales Scripts for This Bundle</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                {(["open", "followup", "value"] as const).map((v, i) => {
                  const labels = { open: "🟢 Opening Pitch", followup: "⚡ Follow-Up", value: "💎 Value Pitch" };
                  const colors = { open: DS.green, followup: "#f59e0b", value: DS.primary };
                  return (
                    <div key={v} className="card" style={{ padding: "16px", borderTop: `3px solid ${colors[v]}` }}>
                      <p style={{ fontWeight: 700, fontSize: 11, color: colors[v], marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{labels[v]}</p>
                      {bundleRows.slice(0, 1).map((r, j) => (
                        <p key={j} style={{ fontSize: 12.5, color: DS.textMuted, lineHeight: 1.75, fontStyle: "italic" }}>{buildScript(r, v)}</p>
                      ))}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {bundleProduct && bundleRows.length === 0 && !bundleLoading && <EmptyState message="No bundle recommendations found for this product." />}
        </>
      )}

      {/* === TAB: Partner Cross-Sell === */}
      {tab === "Partner Cross-Sell" && (
        <>
          <SectionLabel>Partner-Specific Recommendations</SectionLabel>
          <Panel style={{ marginBottom: 16 }}>
            <div style={{ padding: "14px 18px", display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ position: "relative", maxWidth: 340, flex: 1 }}>
                <Users size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: DS.textMuted }} />
                <input className="form-input" style={{ paddingLeft: 28 }} placeholder="Type partner name…" value={partnerName} onChange={e => setPartnerName(e.target.value)} />
              </div>
              {partnerLoading && <span style={{ fontSize: 11, color: DS.textMuted }}>Loading…</span>}
            </div>
          </Panel>
          {partnerName && partnerRows.length > 0 && (
            <Panel>
              <PanelHeader title={`Cross-Sell Plan for ${partnerName}`} sub={`${partnerRows.length} recommendations`} />
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr>
                    <th>They Already Buy</th><th>Recommend Adding</th><th>Conf</th><th>Lift</th>
                    <th>Gain/Wk</th><th>Gain/Mo</th><th>Gain/Yr</th><th>Margin/Mo</th><th>Margin %</th>
                  </tr></thead>
                  <tbody>
                    {partnerRows.map((r, i) => {
                      const conf = Number(r.confidence_a_to_b ?? r.confidence ?? 0);
                      const lift = Number(r.lift_a_to_b ?? r.lift ?? 0);
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{String(r.product_a ?? r.item_a ?? "")}</td>
                          <td style={{ fontWeight: 700, color: DS.primary }}>{String(r.product_b ?? r.item_b ?? "")}</td>
                          <td><span className={`badge ${conf > 0.5 ? "badge-green" : "badge-blue"}`}>{(conf * 100).toFixed(0)}%</span></td>
                          <td style={{ fontWeight: 700, color: lift >= 2 ? DS.green : DS.textMuted }}>{lift.toFixed(2)}×</td>
                          <td>{fmt(r.expected_gain_weekly)}</td>
                          <td style={{ fontWeight: 700 }}>{fmt(r.expected_gain_monthly ?? r.revenue_gain)}</td>
                          <td>{fmt(r.expected_gain_yearly)}</td>
                          <td style={{ color: DS.green }}>{fmt(r.expected_margin_monthly)}</td>
                          <td style={{ color: DS.textMuted }}>{r.margin_rate ? `${(Number(r.margin_rate) * 100).toFixed(0)}%` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
          {partnerName && partnerRows.length === 0 && !partnerLoading && <EmptyState message="No cross-sell opportunities found. Try a different partner name." />}
          {!partnerName && <EmptyState message="Enter a partner name to see their personalised cross-sell opportunities." />}
        </>
      )}

      {/* === TAB: Sequential Patterns === */}
      {tab === "Sequential Patterns" && (() => {
        const seqRows = rows.filter(r => !!r.sequence_flag || r.method === "sequential");
        const displayRows = seqRows.length > 0 ? seqRows : rows.slice(0, 12);
        const usedFallback = seqRows.length === 0;

        // urgency colour by avg days
        function urgencyColor(days: number) {
          if (days <= 7)  return { dot: "#ef4444", badge: "badge-red",   label: "Urgent" };
          if (days <= 21) return { dot: "#f59e0b", badge: "badge-amber", label: "Act Soon" };
          return              { dot: DS.primary,  badge: "badge-blue",  label: "Planned" };
        }

        return (
          <>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <p style={{ fontFamily: "'Manrope',sans-serif", fontSize: 15, fontWeight: 800, color: DS.text }}>
                  Sequential Purchase Patterns
                </p>
                <p style={{ fontSize: 11.5, color: DS.textMuted, marginTop: 2 }}>
                  {usedFallback
                    ? `No explicit sequential rules found — showing top ${displayRows.length} rules in timeline format`
                    : `${displayRows.length} timed sequences · Partner A buys product, then adds B within the window`}
                </p>
              </div>
              <span className="badge badge-blue" style={{ fontSize: 10.5 }}>
                ⏱ Time-Aware Rules
              </span>
            </div>

            {usedFallback && (
              <div className="info-banner info-banner-blue" style={{ marginBottom: 16 }}>
                Sequential rules require <code>sequence_flag=True</code> or <code>method=&quot;sequential&quot;</code> in the API response.
                Showing all rules below in timeline format as a preview.
              </div>
            )}

            {/* Timeline cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {displayRows.map((r, i) => {
                const a = String(r.product_a ?? r.item_a ?? "Product A");
                const b = String(r.product_b ?? r.item_b ?? "Product B");
                const avgDays = Number(r.avg_days_between_purchases ?? r.avg_days_between ?? 0);
                const conf = Number(r.confidence_a_to_b ?? r.confidence ?? 0);
                const lift = Number(r.lift_a_to_b ?? r.lift ?? 0);
                const gainMo = Number(r.expected_gain_monthly ?? r.revenue_gain ?? 0);
                const support = Number(r.support_a ?? r.support ?? 0);
                const urg = urgencyColor(avgDays || 30);

                return (
                  <div key={i} style={{
                    background: "#fff", borderRadius: 14, padding: "18px 20px",
                    boxShadow: "0 2px 12px rgba(25,28,30,0.06)",
                    border: "1px solid rgba(199,196,216,0.2)",
                    borderLeft: `4px solid ${urg.dot}`,
                    transition: "box-shadow 0.15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 24px rgba(25,28,30,0.1)"; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 12px rgba(25,28,30,0.06)"; }}
                  >
                    {/* Row 1: Timeline visual */}
                    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 14 }}>
                      {/* Product A node */}
                      <div style={{ flexShrink: 0, textAlign: "center" }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 12,
                          background: "linear-gradient(135deg, #4F46E5, #818CF8)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(79,70,229,0.3)",
                        }}>
                          <span style={{ fontSize: 18 }}>📦</span>
                        </div>
                        <p style={{ fontSize: 9, fontWeight: 700, color: DS.textMuted, marginTop: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>Trigger</p>
                      </div>

                      {/* Product A label */}
                      <div style={{ marginLeft: 10, minWidth: 0, maxWidth: 180 }}>
                        <p style={{ fontSize: 13, fontWeight: 800, color: DS.text, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a}</p>
                        {support > 0 && <p style={{ fontSize: 9.5, color: DS.textMuted, marginTop: 2 }}>Support: {support}</p>}
                      </div>

                      {/* Arrow rail with days badge */}
                      <div style={{ flex: 1, margin: "0 12px", display: "flex", flexDirection: "column", alignItems: "center", minWidth: 80 }}>
                        {/* Timing badge */}
                        <div style={{
                          padding: "3px 10px", borderRadius: 999, marginBottom: 6,
                          background: `${urg.dot}14`, border: `1px solid ${urg.dot}40`,
                        }}>
                          <p style={{ fontSize: 10, fontWeight: 800, color: urg.dot, whiteSpace: "nowrap" }}>
                            {avgDays > 0 ? `within ${avgDays.toFixed(0)} days` : "sequential"}
                          </p>
                        </div>
                        {/* Rail line */}
                        <div style={{ width: "100%", position: "relative", height: 2 }}>
                          <div style={{ height: 2, background: `linear-gradient(90deg, ${DS.primary}44, ${DS.primary})`, borderRadius: 999 }} />
                          <div style={{ position: "absolute", right: -5, top: -5, color: DS.primary, fontSize: 12, fontWeight: 900 }}>▶</div>
                        </div>
                        <p style={{ fontSize: 9, color: DS.textMuted, marginTop: 5, fontWeight: 600 }}>then buys</p>
                      </div>

                      {/* Product B node */}
                      <div style={{ flexShrink: 0, textAlign: "center" }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 12,
                          background: `linear-gradient(135deg, ${DS.green}, #34D399)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: `0 2px 8px ${DS.green}44`,
                        }}>
                          <span style={{ fontSize: 18 }}>🛒</span>
                        </div>
                        <p style={{ fontSize: 9, fontWeight: 700, color: DS.textMuted, marginTop: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>Next Buy</p>
                      </div>

                      {/* Product B label */}
                      <div style={{ marginLeft: 10, minWidth: 0, maxWidth: 180 }}>
                        <p style={{ fontSize: 13, fontWeight: 800, color: DS.green, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b}</p>
                        {gainMo > 0 && <p style={{ fontSize: 9.5, color: DS.green, marginTop: 2, fontWeight: 700 }}>+{fmt(gainMo)}/mo</p>}
                      </div>

                      {/* Stats badges */}
                      <div style={{ marginLeft: "auto", paddingLeft: 16, display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end", flexShrink: 0 }}>
                        <span className={`badge ${conf > 0.5 ? "badge-green" : "badge-blue"}`} style={{ fontSize: 9.5 }}>
                          Conf {(conf * 100).toFixed(0)}%
                        </span>
                        <span className="badge badge-indigo" style={{ fontSize: 9.5 }}>
                          Lift {lift.toFixed(2)}×
                        </span>
                        <span className={`badge ${urg.badge}`} style={{ fontSize: 9 }}>
                          ⏱ {urg.label}
                        </span>
                      </div>
                    </div>

                    {/* Row 2: Outreach sentence */}
                    <div style={{
                      background: "#f7f9fb", borderRadius: 8, padding: "8px 12px",
                      borderLeft: `3px solid ${urg.dot}`,
                    }}>
                      <p style={{ fontSize: 11.5, color: DS.textMuted, lineHeight: 1.65, margin: 0 }}>
                        <span style={{ fontWeight: 700, color: DS.text }}>📞 Talk track: </span>
                        {avgDays > 0
                          ? `Partners who buy <b>${a}</b> typically add <b>${b}</b> within <b>${avgDays.toFixed(0)} days</b> — ${conf > 0.5 ? "this is a strong pattern" : "this is an emerging pattern"} with ${lift.toFixed(1)}× lift. ${gainMo > 0 ? `Catch them before day ${Math.ceil(avgDays / 2)} and you could unlock ${fmt(gainMo)}/month.` : "Reach out proactively before they source it elsewhere."}`
                          : `Customers who buy <b>${a}</b> often follow up with <b>${b}</b>. With ${(conf * 100).toFixed(0)}% confidence, proactively suggesting it at the checkout step could generate strong incremental revenue.`
                        }
                      </p>
                    </div>
                  </div>
                );
              })}

              {displayRows.length === 0 && (
                <div style={{ padding: "32px 0" }}>
                  <EmptyState message="No rules available yet. Adjust the confidence/lift filters or run the association analysis." />
                </div>
              )}
            </div>
          </>
        );
      })()}


      {/* === TAB: Cross-Category Upgrades === */}
      {tab === "Cross-Category Upgrades" && (
        <Panel>
          <PanelHeader title="Cross-Category Expansion Opportunities" sub="Partners who expanded from one category to another — proven upgrade paths" />
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr>
                <th>Category A (Origin)</th><th>Category B (Expansion)</th><th>Product A</th><th>Product B</th><th>Lift</th><th>Revenue Gain</th>
              </tr></thead>
              <tbody>
                {rows.filter(r => r.category_a && r.category_b && r.category_a !== r.category_b).map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, color: DS.primary }}>{String(r.category_a ?? "")}</td>
                    <td style={{ fontWeight: 600, color: DS.green }}>{String(r.category_b ?? "")}</td>
                    <td>{String(r.product_a ?? r.item_a ?? "")}</td>
                    <td>{String(r.product_b ?? r.item_b ?? "")}</td>
                    <td style={{ fontWeight: 700 }}>{Number(r.lift_a_to_b ?? r.lift ?? 0).toFixed(2)}×</td>
                    <td>{fmt(r.expected_gain_monthly ?? r.revenue_gain)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.filter(r => r.category_a && r.category_b && r.category_a !== r.category_b).length === 0 && (
            <div style={{ padding: "28px 20px" }}>
              <div className="info-banner info-banner-blue">Cross-category data comes from the association rules. If category columns are not in the data, all rules automatically show here as potential cross-category signals.</div>
              {rows.slice(0, 10).map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: "1px solid rgba(199,196,216,0.12)", fontSize: 12.5 }}>
                  <BarChart2 size={13} style={{ color: DS.primary }} />
                  <span style={{ fontWeight: 700 }}>{String(r.product_a ?? r.item_a ?? "")}</span>
                  <TrendingUp size={12} style={{ color: DS.green }} />
                  <span style={{ color: DS.primary, fontWeight: 600 }}>{String(r.product_b ?? r.item_b ?? "")}</span>
                  <span className="badge badge-indigo" style={{ marginLeft: "auto" }}>Lift {Number(r.lift_a_to_b ?? r.lift ?? 0).toFixed(2)}×</span>
                  <span style={{ fontSize: 11, color: DS.textMuted }}>{fmt(r.expected_gain_monthly ?? r.revenue_gain)} gain/mo</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
