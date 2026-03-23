"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, Skeleton, ErrorBanner } from "@/components/ui";

const LANE_STYLES: Record<string, { border: string; bg: string; badge: string; text: string }> = {
  champion: { border: "#22c55e", bg: "#22c55e11", badge: "#22c55e", text: "text-emerald-400" },
  healthy:  { border: "#3b82f6", bg: "#3b82f611", badge: "#3b82f6", text: "text-blue-400" },
  at_risk:  { border: "#f59e0b", bg: "#f59e0b11", badge: "#f59e0b", text: "text-amber-400" },
  critical: { border: "#ef4444", bg: "#ef444411", badge: "#ef4444", text: "text-red-400" },
};

function fmtInr(val: unknown) {
  const v = Number(val ?? 0);
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(0)}K`;
  return `₹${v.toFixed(0)}`;
}

export default function PipelinePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["pipeline-kanban"],
    queryFn: () => api.pipeline.kanban(),
  });

  const lanes = data?.lanes ?? [];

  if (error) return <ErrorBanner message="Could not load pipeline data." />;

  return (
    <div>
      <PageHeader
        icon="📊"
        title="Revenue Pipeline Tracker"
        subtitle="Monitor partner health across every stage — Champion, Healthy, At Risk, and Critical."
        accentColor="#6366f1"
      />

      {isLoading ? (
        <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-96" />)}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {lanes.map((lane) => {
            const l = lane as Record<string, unknown>;
            const key = String(l.key ?? "");
            const style = LANE_STYLES[key] ?? LANE_STYLES.healthy;
            const partners = (l.partners as Record<string, unknown>[]) ?? [];

            return (
              <div key={key} className="flex flex-col" style={{ borderTop: `2px solid ${style.border}`, background: style.bg, borderRadius: 12, padding: "16px 12px" }}>
                <div className="flex items-center justify-between mb-4">
                  <p className={`font-semibold text-sm ${style.text}`}>{String(l.label ?? "")}</p>
                  <span className="badge text-white" style={{ background: style.border }}>
                    {String(l.count ?? 0)}
                  </span>
                </div>
                <div className="space-y-2 overflow-y-auto max-h-[500px] pr-1">
                  {partners.map((p, i) => (
                    <div key={i} className="kanban-card">
                      <p className="text-white text-xs font-semibold truncate mb-1">{String(p.company_name ?? "—")}</p>
                      <p className="text-[#6b7280] text-[10px] mb-2">{String(p.state ?? "—")}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#9ca3af]">Rev 90d</span>
                        <span className="text-xs font-medium text-white">{fmtInr(p.recent_90_revenue)}</span>
                      </div>
                      {p.churn_probability != null && (
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-[#9ca3af]">Churn</span>
                          <span className="text-[10px] font-medium text-amber-400">{(Number(p.churn_probability) * 100).toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {partners.length === 0 && <p className="text-[#4b5563] text-xs text-center py-6">No partners in this lane.</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
