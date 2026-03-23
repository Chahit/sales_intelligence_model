"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, MetricCard, Skeleton, ErrorBanner, SectionHeader } from "@/components/ui";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#6366f1", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

export default function ClusterIntelligencePage() {
  const { data: summary, isLoading, error } = useQuery({
    queryKey: ["cluster-summary"],
    queryFn: () => api.clustering.summary(),
  });

  const { data: matrixData, isLoading: loadingMatrix } = useQuery({
    queryKey: ["cluster-matrix"],
    queryFn: () => api.clustering.matrix(),
  });

  const clusters = (summary?.clusters as Record<string, unknown>[]) ?? [];
  const pieData = clusters
    .filter(c => !String(c.cluster_label).toLowerCase().includes("outlier"))
    .map((c, i) => ({ name: String(c.cluster_label), value: Number(c.partners), color: COLORS[i % COLORS.length] }));

  const matrixRows = (matrixData?.rows as Record<string, unknown>[]) ?? [];

  if (error) return <ErrorBanner message="Could not load clustering data." />;

  return (
    <div>
      <PageHeader
        icon="🧠"
        title="Cluster Intelligence"
        subtitle="AI-powered partner segmentation — VIP, Growth, At-Risk segments."
        accentColor="#8b5cf6"
        badge="ML"
      />

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4 mb-6">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <MetricCard label="Total Clusters" value={(summary?.n_clusters as number) ?? "—"} accentColor="#8b5cf6" />
          <MetricCard label="VIP Partners" value={(summary?.n_vip as number) ?? "—"} accentColor="#f59e0b" />
          <MetricCard label="Outliers" value={(summary?.n_outliers as number) ?? "—"} deltaPositive={false} accentColor="#6b7280" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Pie Chart */}
        <div className="glass p-5">
          <p className="text-sm font-semibold text-white mb-4">Cluster Distribution</p>
          {isLoading ? <Skeleton className="h-52" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label={(props) => { const { name, percent } = props as { name?: string; percent?: number }; return `${name ?? ""} (${((percent ?? 0) * 100).toFixed(0)}%)`; }}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Cluster breakdown table */}
        <div className="glass p-5">
          <p className="text-sm font-semibold text-white mb-4">Cluster Breakdown</p>
          {isLoading ? <Skeleton className="h-52" /> : (
            <table className="data-table">
              <thead>
                <tr><th>Cluster</th><th>Type</th><th>Partners</th></tr>
              </thead>
              <tbody>
                {clusters.map((c, i) => (
                  <tr key={i}>
                    <td className="text-white font-medium">{String(c.cluster_label)}</td>
                    <td>
                      <span className="badge" style={{
                        background: c.cluster_type === "VIP" ? "#f59e0b22" : "#6366f122",
                        color: c.cluster_type === "VIP" ? "#f59e0b" : "#818cf8",
                      }}>
                        {String(c.cluster_type ?? "Growth")}
                      </span>
                    </td>
                    <td className="text-[#d1d5db]">{String(c.partners ?? "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Partner Matrix */}
      <SectionHeader title="Partner DNA Matrix" />
      <div className="glass overflow-x-auto">
        {loadingMatrix ? <Skeleton className="h-64" /> : (
          <table className="data-table">
            <thead>
              <tr><th>Partner</th><th>State</th><th>Cluster</th><th>Type</th><th>Tag</th></tr>
            </thead>
            <tbody>
              {matrixRows.slice(0, 50).map((row, i) => (
                <tr key={i}>
                  <td className="text-white font-medium">{String(row.company_name ?? "—")}</td>
                  <td className="text-[#9ca3af]">{String(row.state ?? "—")}</td>
                  <td>
                    <span className="badge" style={{ background: "#6366f122", color: "#a5b4fc" }}>
                      {String(row.cluster_label ?? "—")}
                    </span>
                  </td>
                  <td className="text-[#9ca3af]">{String(row.cluster_type ?? "—")}</td>
                  <td className="text-[#6b7280] text-xs">{String(row.strategic_tag ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
