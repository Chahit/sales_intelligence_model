"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, Skeleton, ErrorBanner, SectionHeader } from "@/components/ui";

export default function RecommendationHub() {
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedPartner, setSelectedPartner] = useState<string>("");
  const [nlQuery, setNlQuery] = useState<string>("");
  const [nlResult, setNlResult] = useState<Record<string, unknown> | null>(null);
  const [loadingNL, setLoadingNL] = useState(false);
  const [activeTab, setActiveTab] = useState<"plan" | "nl">("plan");

  const { data: statesData } = useQuery({ queryKey: ["partner-states"], queryFn: () => api.partner.states() });
  const { data: partnersData } = useQuery({
    queryKey: ["partner-list", selectedState],
    queryFn: () => api.partner.list(selectedState),
    enabled: !!selectedState,
  });

  const { data: plan, isLoading: loadingPlan, error } = useQuery({
    queryKey: ["rec-plan", selectedPartner],
    queryFn: () => api.recommendations.plan(selectedPartner, 3),
    enabled: !!selectedPartner,
  });

  const actions = (plan?.actions as Record<string, unknown>[]) ?? (plan?.recommendations as Record<string, unknown>[]) ?? [];

  async function runNLQuery() {
    if (!nlQuery.trim()) return;
    setLoadingNL(true);
    try {
      const result = await api.recommendations.nlQuery(nlQuery, selectedState || undefined, 25);
      setNlResult(result as Record<string, unknown>);
    } catch {
      setNlResult({ status: "error", reason: "Query failed." });
    } finally {
      setLoadingNL(false);
    }
  }

  if (error) return <ErrorBanner message="Could not load recommendation data." />;

  return (
    <div>
      <PageHeader icon="💡" title="Recommendation Hub" subtitle="Partner-specific AI action playbooks driven by cluster, churn, credit, and peer gap signals." accentColor="#f59e0b" badge="AI-Powered" />

      {/* Filters */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs text-[#6b7280] mb-1 block uppercase tracking-wider">State</label>
          <select className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white" value={selectedState} onChange={e => { setSelectedState(e.target.value); setSelectedPartner(""); }}>
            <option value="">Select state…</option>
            {statesData?.states?.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-[#6b7280] mb-1 block uppercase tracking-wider">Partner</label>
          <select className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white" value={selectedPartner} onChange={e => setSelectedPartner(e.target.value)} disabled={!selectedState}>
            <option value="">Select partner…</option>
            {partnersData?.partners?.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-white/[0.06]">
        {(["plan", "nl"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-all rounded-t-lg ${activeTab === tab ? "bg-amber-500/20 text-amber-400 border border-b-0 border-amber-500/30" : "text-[#6b7280] hover:text-white"}`}
          >
            {tab === "plan" ? "📋 Recommendations" : "🔍 NL Query"}
          </button>
        ))}
      </div>

      {activeTab === "plan" && (
        <>
          {!selectedPartner && <div className="glass p-8 text-center text-[#6b7280]">👆 Select a partner to view their AI recommendation plan.</div>}
          {loadingPlan && <Skeleton className="h-48" />}
          {plan && (
            <>
              {/* Summary */}
              {plan.partner_summary && (
                <div className="glass p-4 mb-4">
                  <p className="text-xs text-amber-400 font-semibold mb-1 uppercase tracking-wider">Partner Context</p>
                  <p className="text-sm text-[#d1d5db]">{String(plan.partner_summary)}</p>
                </div>
              )}
              <SectionHeader title="Action Playbook" />
              <div className="space-y-3">
                {actions.map((action, i) => {
                  const a = action as Record<string, unknown>;
                  return (
                    <div key={i} className="glass p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="badge" style={{ background: "#f59e0b22", color: "#f59e0b" }}>{String(a.action_type ?? "Action")}</span>
                            {a.priority_score != null && (
                              <span className="text-xs text-[#6b7280]">Priority: {Number(a.priority_score).toFixed(2)}</span>
                            )}
                          </div>
                          <p className="text-sm text-white font-medium">{String(a.recommended_offer ?? a.offer ?? a.action ?? "—")}</p>
                          {!!a.reasoning && <p className="text-xs text-[#6b7280] mt-1">{String(a.reasoning)}</p>}
                        </div>
                        {a.safe_discount_pct != null && (
                          <span className="text-emerald-400 font-bold text-sm ml-4">{Number(a.safe_discount_pct).toFixed(1)}% off</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {actions.length === 0 && selectedPartner && !loadingPlan && (
                  <p className="text-[#6b7280] text-sm text-center py-8">No recommendations available for this partner.</p>
                )}
              </div>
            </>
          )}
        </>
      )}

      {activeTab === "nl" && (
        <>
          <SectionHeader title="Natural Language Query" />
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50"
              placeholder="e.g. Show high-margin recs for low-credit-risk VIPs in Delhi"
              value={nlQuery}
              onChange={e => setNlQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && runNLQuery()}
            />
            <button
              onClick={runNLQuery}
              disabled={loadingNL}
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition disabled:opacity-50"
            >
              {loadingNL ? "Running…" : "Run Query"}
            </button>
          </div>

          {nlResult && (
            <>
              <p className="text-xs text-[#6b7280] mb-3">Found {String(nlResult.total_matches ?? 0)} matches across {String(nlResult.scanned_partners ?? 0)} partners.</p>
              {Array.isArray(nlResult.results) && nlResult.results.length > 0 && (
                <div className="glass overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr><th>Partner</th><th>State</th><th>Action</th><th>Offer</th><th>Priority</th></tr>
                    </thead>
                    <tbody>
                      {(nlResult.results as Record<string, unknown>[]).map((row, i) => (
                        <tr key={i}>
                          <td className="text-white font-medium">{String(row.partner_name ?? "—")}</td>
                          <td className="text-[#9ca3af]">{String(row.state ?? "—")}</td>
                          <td><span className="badge" style={{ background: "#f59e0b22", color: "#f59e0b" }}>{String(row.action_type ?? "—")}</span></td>
                          <td className="text-[#d1d5db] text-xs max-w-xs">{String(row.recommended_offer ?? "—")}</td>
                          <td className="text-emerald-400 font-medium">{Number(row.priority_score ?? 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
