"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, MetricCard, Skeleton, ErrorBanner, SectionHeader } from "@/components/ui";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const STAGE_COLORS: Record<string, string> = {
  Growing: "#10b981", Mature: "#3b82f6", Plateauing: "#f59e0b",
  Declining: "#ef4444", "End-of-Life": "#6b7280",
};

export default function ProductLifecyclePage() {
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [stageFilter, setStageFilter] = useState<string>("All");

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["lifecycle-summary"],
    queryFn: () => api.lifecycle.summary(),
  });

  const { data: velocityData, isLoading: loadingVelocity } = useQuery({
    queryKey: ["lifecycle-velocity", stageFilter],
    queryFn: () => api.lifecycle.velocity(stageFilter === "All" ? undefined : stageFilter),
  });

  const { data: eolData } = useQuery({
    queryKey: ["lifecycle-eol"],
    queryFn: () => api.lifecycle.eol(),
  });

  const { data: trendData, isLoading: loadingTrend } = useQuery({
    queryKey: ["lifecycle-trend", selectedProduct],
    queryFn: () => api.lifecycle.trend(selectedProduct),
    enabled: !!selectedProduct,
  });

  const rows = velocityData?.rows ?? [];
  const eolRows = eolData?.rows ?? [];
  const productNames = [...new Set(rows.map((r) => String((r as Record<string, unknown>).product_name)))];

  if (loadingSummary) return <Skeleton className="h-64" />;

  return (
    <div>
      <PageHeader
        icon="📈"
        title="Product Lifecycle Intelligence"
        subtitle="Track product growth velocity, detect cannibalization, and predict end-of-life timelines."
        accentColor="#ec4899"
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        {[
          { label: "Total", key: "total_products", color: "#6366f1" },
          { label: "Growing 🚀", key: "growing", color: "#10b981" },
          { label: "Mature 📊", key: "mature", color: "#3b82f6" },
          { label: "Plateauing ⏸", key: "plateauing", color: "#f59e0b" },
          { label: "Declining 📉", key: "declining", color: "#ef4444" },
          { label: "End-of-Life ⚠️", key: "end_of_life", color: "#6b7280" },
        ].map(({ label, key, color }) => (
          <MetricCard key={key} label={label} value={(summary as Record<string, unknown>)?.[key] as number ?? "—"} accentColor={color} />
        ))}
      </div>

      {/* Filter Row */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {["All", "Growing", "Mature", "Plateauing", "Declining", "End-of-Life"].map(s => (
          <button
            key={s}
            onClick={() => setStageFilter(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: stageFilter === s ? `${STAGE_COLORS[s] || "#6366f1"}33` : "rgba(255,255,255,0.03)",
              border: `1px solid ${stageFilter === s ? (STAGE_COLORS[s] || "#6366f1") + "55" : "rgba(255,255,255,0.08)"}`,
              color: stageFilter === s ? (STAGE_COLORS[s] || "#818cf8") : "#9ca3af",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Velocity Table */}
      <SectionHeader title="Growth Velocity Scorecard" />
      <div className="glass overflow-x-auto mb-6">
        {loadingVelocity ? <Skeleton className="h-48" /> : (
          <table className="data-table">
            <thead>
              <tr><th>Product</th><th>Stage</th><th>Velocity</th><th>3M Growth %</th><th>Trend Slope %</th><th>Avg Monthly Rev</th></tr>
            </thead>
            <tbody>
              {rows.slice(0, 30).map((row, i) => {
                const r = row as Record<string, unknown>;
                const stage = String(r.lifecycle_stage ?? "");
                const color = STAGE_COLORS[stage] ?? "#9ca3af";
                return (
                  <tr key={i}>
                    <td>
                      <button
                        className="text-left text-white font-medium hover:text-indigo-400 transition"
                        onClick={() => setSelectedProduct(String(r.product_name ?? ""))}
                      >
                        {String(r.product_name ?? "—")}
                      </button>
                    </td>
                    <td><span className="badge" style={{ background: `${color}22`, color }}>{stage}</span></td>
                    <td className="text-[#d1d5db]">{Number(r.velocity_score ?? 0).toFixed(3)}</td>
                    <td className={Number(r.growth_3m_pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {Number(r.growth_3m_pct ?? 0) >= 0 ? "+" : ""}{Number(r.growth_3m_pct ?? 0).toFixed(1)}%
                    </td>
                    <td className="text-[#9ca3af]">{Number(r.slope_pct ?? 0) >= 0 ? "+" : ""}{Number(r.slope_pct ?? 0).toFixed(1)}%</td>
                    <td className="text-[#d1d5db]">₹{Number(r.avg_monthly_revenue ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Drilldown */}
      <SectionHeader title="Product Trend Drilldown" />
      <div className="mb-4">
        <select
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/50"
          value={selectedProduct}
          onChange={e => setSelectedProduct(e.target.value)}
        >
          <option value="">Select a product…</option>
          {productNames.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {selectedProduct && (
        loadingTrend ? <Skeleton className="h-48" /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="glass p-4">
              <p className="text-sm font-semibold text-white mb-3">Monthly Revenue</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData?.rows ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="sale_month" tick={{ fill: "#6b7280", fontSize: 9 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 9 }} />
                  <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="monthly_revenue" stroke="#ec4899" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="glass p-4">
              <p className="text-sm font-semibold text-white mb-3">Monthly Buyer Count</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trendData?.rows ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="sale_month" tick={{ fill: "#6b7280", fontSize: 9 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 9 }} />
                  <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                  <Bar dataKey="monthly_buyer_count" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      )}

      {/* EOL Predictions */}
      <SectionHeader title="End-of-Life Predictions" />
      <div className="glass overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr><th>Product</th><th>Urgency</th><th>EOL Risk</th><th>Est. Months to Zero</th><th>Suggested Action</th></tr>
          </thead>
          <tbody>
            {eolRows.slice(0, 20).map((row, i) => {
              const r = row as Record<string, unknown>;
              const urgencyColors: Record<string, string> = { Critical: "#ef4444", High: "#f97316", Medium: "#f59e0b", Low: "#10b981" };
              const urgency = String(r.urgency ?? "Low");
              const color = urgencyColors[urgency] ?? "#9ca3af";
              return (
                <tr key={i}>
                  <td className="text-white font-medium">{String(r.product_name ?? "—")}</td>
                  <td><span className="badge" style={{ background: `${color}22`, color }}>{urgency}</span></td>
                  <td className="text-[#d1d5db]">{Number(r.eol_risk_score ?? 0).toFixed(3)}</td>
                  <td className="text-[#d1d5db]">{Number(r.est_months_to_zero ?? 0).toFixed(1)}</td>
                  <td className="text-[#9ca3af] text-xs max-w-xs">{String(r.suggested_action ?? "—")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
