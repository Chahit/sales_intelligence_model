"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { MetricCard, PageHeader, Skeleton, ErrorBanner } from "@/components/ui";

export default function HomePage() {
  const { data: snapshot, isLoading, error } = useQuery({
    queryKey: ["monitoring-snapshot"],
    queryFn: () => api.monitoring.snapshot(),
  });

  const { data: lifecycleSummary } = useQuery({
    queryKey: ["lifecycle-summary"],
    queryFn: () => api.lifecycle.summary(),
  });

  const { data: leaderboard } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => api.salesRep.leaderboard(),
  });

  const topRep = (leaderboard?.rows?.[0] as Record<string, unknown>) ?? null;

  if (error) return <ErrorBanner message="Could not load dashboard. Is the backend running?" />;

  return (
    <div>
      <PageHeader
        icon="🏠"
        title="Executive Dashboard"
        subtitle="AI-powered overview of your partner network, product health, and sales engine."
        accentColor="#6366f1"
      />

      {/* KPI Row */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <MetricCard
            label="Total Partners"
            value={(snapshot?.partner_count as number) ?? "—"}
            accentColor="#6366f1"
          />
          <MetricCard
            label="Active Clusters"
            value={(snapshot?.cluster_count as number) ?? "—"}
            accentColor="#8b5cf6"
          />
          <MetricCard
            label="Growing Products"
            value={(lifecycleSummary?.growing as number) ?? "—"}
            accentColor="#10b981"
          />
          <MetricCard
            label="Avg Churn Risk"
            value={
              snapshot?.avg_churn_probability != null
                ? `${(Number(snapshot.avg_churn_probability) * 100).toFixed(1)}%`
                : "—"
            }
            deltaPositive={false}
            accentColor="#ef4444"
          />
        </div>
      )}

      {/* Two-column secondary metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Lifecycle summary */}
        <div className="glass p-5">
          <h2 className="text-sm font-semibold text-white mb-4">📈 Product Lifecycle At a Glance</h2>
          {isLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Growing 🚀", key: "growing", color: "#10b981" },
                { label: "Mature 📊", key: "mature", color: "#3b82f6" },
                { label: "Declining 📉", key: "declining", color: "#ef4444" },
                { label: "Plateauing ⏸", key: "plateauing", color: "#f59e0b" },
                { label: "End-of-Life ⚠️", key: "end_of_life", color: "#6b7280" },
                { label: "Total", key: "total_products", color: "#6366f1" },
              ].map(({ label, key, color }) => (
                <div key={key} className="text-center py-3 px-2 rounded-lg" style={{ background: `${color}11` }}>
                  <p className="text-xl font-bold" style={{ color }}>{(lifecycleSummary?.[key] as number) ?? "—"}</p>
                  <p className="text-[10px] text-[#6b7280] mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Rep */}
        <div className="glass p-5">
          <h2 className="text-sm font-semibold text-white mb-4">🏆 Top Sales Rep</h2>
          {isLoading ? (
            <Skeleton className="h-32" />
          ) : topRep ? (
            <div>
              <p className="text-2xl font-bold text-white">{String(topRep.sales_rep_name ?? "—")}</p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-white/[0.03] rounded-lg p-3">
                  <p className="text-xs text-[#6b7280]">Partners</p>
                  <p className="text-lg font-bold text-emerald-400">{String(topRep.partner_count ?? "—")}</p>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3">
                  <p className="text-xs text-[#6b7280]">Revenue</p>
                  <p className="text-lg font-bold text-indigo-400">
                    {topRep.total_revenue
                      ? `₹${(Number(topRep.total_revenue) / 100000).toFixed(1)}L`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[#6b7280] text-sm">No rep data available.</p>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="glass p-5">
        <h2 className="text-sm font-semibold text-white mb-3">⚡ Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/partner-360",        label: "Partner 360",     icon: "🤝", color: "#2563eb" },
            { href: "/recommendation-hub", label: "Get Reco",        icon: "💡", color: "#f59e0b" },
            { href: "/inventory",          label: "Clear Dead Stock", icon: "📦", color: "#dc2626" },
            { href: "/pipeline",           label: "View Pipeline",   icon: "📊", color: "#6366f1" },
          ].map(({ href, label, icon, color }) => (
            <a
              key={href}
              href={href}
              className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all hover:brightness-110"
              style={{ background: `${color}22`, border: `1px solid ${color}33`, color }}
            >
              <span>{icon}</span> {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
