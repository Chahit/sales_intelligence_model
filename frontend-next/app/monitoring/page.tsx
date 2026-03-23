"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, MetricCard, Skeleton, ErrorBanner, SectionHeader } from "@/components/ui";

export default function MonitoringPage() {
  const { data: snapshot, isLoading, error } = useQuery({
    queryKey: ["monitoring-snapshot"],
    queryFn: () => api.monitoring.snapshot(),
  });

  const { data: alerts } = useQuery({
    queryKey: ["monitoring-alerts"],
    queryFn: () => api.monitoring.alerts(),
  });

  const alertRows = (alerts?.rows as Record<string, unknown>[]) ?? [];
  const alertSummary = (alerts?.summary as Record<string, unknown>) ?? {};

  if (error) return <ErrorBanner message="Could not load monitoring data." />;

  return (
    <div>
      <PageHeader icon="🖥️" title="Monitoring" subtitle="System health, model performance, data quality diagnostics, and operational alerts." accentColor="#06b6d4" badge="Live" />

      {isLoading ? (
        <div className="grid grid-cols-4 gap-4 mb-6">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Partners" value={(snapshot?.partner_count as number) ?? "—"} accentColor="#06b6d4" />
            <MetricCard label="Clusters" value={(snapshot?.cluster_count as number) ?? "—"} accentColor="#8b5cf6" />
            <MetricCard label="Outliers" value={(snapshot?.outlier_count as number) ?? "—"} deltaPositive={false} accentColor="#6b7280" />
            <MetricCard
              label="Avg Health Score"
              value={snapshot?.avg_health_score != null ? (Number(snapshot.avg_health_score) * 100).toFixed(0) + "%" : "—"}
              accentColor="#10b981"
            />
          </div>

          {/* System flags */}
          <SectionHeader title="System Configuration" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Fast Mode", key: "fast_mode" },
              { label: "Strict View Only", key: "strict_view_only" },
              { label: "Realtime Scoring", key: "enable_realtime_partner_scoring" },
              { label: "Core Cache TTL", key: "core_cache_ttl_sec" },
            ].map(({ label, key }) => (
              <div key={key} className="glass p-4">
                <p className="text-xs text-[#6b7280] mb-1 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-semibold text-white">
                  {snapshot?.[key] === true ? <span className="text-emerald-400">✅ ON</span>
                    : snapshot?.[key] === false ? <span className="text-red-400">❌ OFF</span>
                    : String(snapshot?.[key] ?? "—")}
                </p>
              </div>
            ))}
          </div>

          {/* Alerts */}
          <SectionHeader title="Operational Alerts" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <MetricCard label="Partners with Alerts" value={(alertSummary.partners_with_alerts as number) ?? "—"} accentColor="#f59e0b" />
            <MetricCard label="Revenue Drop" value={(alertSummary.sharp_revenue_drop_count as number) ?? "—"} deltaPositive={false} accentColor="#ef4444" />
            <MetricCard label="Churn Jump" value={(alertSummary.high_churn_jump_count as number) ?? "—"} deltaPositive={false} accentColor="#f97316" />
            <MetricCard label="Credit Jump" value={(alertSummary.high_credit_risk_jump_count as number) ?? "—"} deltaPositive={false} accentColor="#dc2626" />
          </div>

          {alertRows.length > 0 && (
            <div className="glass overflow-x-auto mb-6">
              <table className="data-table">
                <thead>
                  <tr><th>Partner</th><th>Triggered Rules</th><th>Churn</th><th>Credit Risk</th><th>Revenue Drop</th></tr>
                </thead>
                <tbody>
                  {alertRows.map((row, i) => (
                    <tr key={i}>
                      <td className="text-white font-medium">{String(row.company_name ?? "—")}</td>
                      <td className="text-amber-400 text-xs">{String(row.triggered_rules ?? "—")}</td>
                      <td className="text-red-400">{row.churn_probability != null ? `${(Number(row.churn_probability) * 100).toFixed(1)}%` : "—"}</td>
                      <td className="text-amber-400">{row.credit_risk_score != null ? `${(Number(row.credit_risk_score) * 100).toFixed(1)}%` : "—"}</td>
                      <td className="text-red-400">{row.revenue_drop_pct != null ? `${Number(row.revenue_drop_pct).toFixed(1)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Avg scores */}
          <SectionHeader title="AI Model Averages" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricCard label="Avg Churn Probability" value={snapshot?.avg_churn_probability != null ? `${(Number(snapshot.avg_churn_probability) * 100).toFixed(1)}%` : "—"} deltaPositive={false} accentColor="#ef4444" />
            <MetricCard label="Avg Credit Risk" value={snapshot?.avg_credit_risk_score != null ? `${(Number(snapshot.avg_credit_risk_score) * 100).toFixed(1)}%` : "—"} deltaPositive={false} accentColor="#f97316" />
            <MetricCard label="Avg Health Score" value={snapshot?.avg_health_score != null ? `${(Number(snapshot.avg_health_score) * 100).toFixed(1)}%` : "—"} accentColor="#10b981" />
          </div>
        </>
      )}
    </div>
  );
}
