"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, Skeleton, ErrorBanner, SectionHeader } from "@/components/ui";
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function SalesRepPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["sales-rep-leaderboard"],
    queryFn: () => api.salesRep.leaderboard(),
  });

  const rows = data?.rows ?? [];

  if (error) return <ErrorBanner message="Could not load sales rep data." />;

  return (
    <div>
      <PageHeader
        icon="💼"
        title="Sales Rep Performance"
        subtitle="Monitor field rep ROI, tours, partner coverage, and revenue generation."
        accentColor="#10b981"
      />

      {isLoading ? <Skeleton className="h-64" /> : (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="metric-card">
              <p className="text-xs text-[#6b7280] mb-1 uppercase tracking-wider">Total Reps</p>
              <p className="text-2xl font-bold text-white">{rows.length}</p>
            </div>
            <div className="metric-card">
              <p className="text-xs text-[#6b7280] mb-1 uppercase tracking-wider">Top Rep</p>
              <p className="text-lg font-bold text-emerald-400">{String((rows[0] as Record<string, unknown>)?.sales_rep_name ?? "—")}</p>
            </div>
            <div className="metric-card">
              <p className="text-xs text-[#6b7280] mb-1 uppercase tracking-wider">Total Partners</p>
              <p className="text-2xl font-bold text-white">
                {rows.reduce((acc, r) => acc + Number((r as Record<string, unknown>).partner_count ?? 0), 0)}
              </p>
            </div>
          </div>

          {/* Scatter chart */}
          <SectionHeader title="Revenue vs Partner Coverage" />
          <div className="glass p-5 mb-6">
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="partner_count" name="Partners" tick={{ fill: "#6b7280", fontSize: 11 }} label={{ value: "Partners", position: "insideBottom", fill: "#6b7280", offset: -5 }} />
                <YAxis dataKey="total_revenue" name="Revenue" tick={{ fill: "#6b7280", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => (typeof v === "number" && v > 1000 ? `₹${(v / 100000).toFixed(1)}L` : String(v ?? ""))}
                />
                <Scatter data={rows} fill="#10b981" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Leaderboard Table */}
          <SectionHeader title="Leaderboard" />
          <div className="glass overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Rep Name</th>
                  <th>Partners</th>
                  <th>Tours</th>
                  <th>Revenue Generated</th>
                  <th>Active Orders</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const r = row as Record<string, unknown>;
                  return (
                    <tr key={i}>
                      <td className={i === 0 ? "text-amber-400 font-bold" : i === 1 ? "text-[#d1d5db]" : "text-[#6b7280]"}>
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                      </td>
                      <td className="text-white font-medium">{String(r.sales_rep_name ?? "—")}</td>
                      <td className="text-[#d1d5db]">{String(r.partner_count ?? "—")}</td>
                      <td className="text-[#d1d5db]">{String(r.tour_count ?? r.total_tours ?? "—")}</td>
                      <td className="text-emerald-400 font-medium">
                        {r.total_revenue ? `₹${(Number(r.total_revenue) / 100000).toFixed(1)}L` : "—"}
                      </td>
                      <td className="text-[#d1d5db]">{String(r.active_orders ?? r.order_count ?? "—")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
