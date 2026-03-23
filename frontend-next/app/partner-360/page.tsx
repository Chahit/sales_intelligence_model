"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, Skeleton, ErrorBanner, SectionHeader, MetricCard } from "@/components/ui";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

function Gauge({ value, max = 1, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="relative w-full bg-white/[0.05] rounded-full h-2 mt-2">
      <div className="absolute left-0 top-0 h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function Partner360Page() {
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedPartner, setSelectedPartner] = useState<string>("");

  const { data: statesData, isLoading: loadingStates } = useQuery({
    queryKey: ["partner-states"],
    queryFn: () => api.partner.states(),
  });

  const { data: partnersData, isLoading: loadingPartners } = useQuery({
    queryKey: ["partner-list", selectedState],
    queryFn: () => api.partner.list(selectedState),
    enabled: !!selectedState,
  });

  const { data: report, isLoading: loadingReport, error } = useQuery({
    queryKey: ["partner-intel", selectedPartner],
    queryFn: () => api.partner.intelligence(selectedPartner),
    enabled: !!selectedPartner,
  });

  const facts = report?.facts as Record<string, unknown> | undefined;
  const gaps = report?.gaps as Record<string, unknown>[] | undefined;
  const monthly = report?.monthly_revenue_history as Record<string, unknown>[] | undefined;
  const alerts = report?.alerts as Record<string, unknown>[] | undefined;

  return (
    <div>
      <PageHeader
        icon="🤝"
        title="Partner 360 View"
        subtitle="Deep-dive into any partner — revenue health, churn risk, forecast, and recommendations."
        accentColor="#2563eb"
      />

      {/* Filters */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-xs text-[#6b7280] mb-1 block font-medium uppercase tracking-wider">State / Region</label>
          {loadingStates ? <Skeleton className="h-10" /> : (
            <select
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
              value={selectedState}
              onChange={e => { setSelectedState(e.target.value); setSelectedPartner(""); }}
            >
              <option value="">Select state…</option>
              {statesData?.states?.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="text-xs text-[#6b7280] mb-1 block font-medium uppercase tracking-wider">Partner</label>
          {loadingPartners ? <Skeleton className="h-10" /> : (
            <select
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
              value={selectedPartner}
              onChange={e => setSelectedPartner(e.target.value)}
              disabled={!selectedState}
            >
              <option value="">Select partner…</option>
              {partnersData?.partners?.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
        </div>
      </div>

      {!selectedPartner && (
        <div className="glass p-8 text-center text-[#6b7280]">
          👆 Select a state and partner to view their 360° intelligence report.
        </div>
      )}

      {loadingReport && <Skeleton className="h-64" />}
      {error && <ErrorBanner message="Could not load partner data." />}

      {report && facts && (
        <>
          {/* Alerts */}
          {alerts && alerts.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
              {alerts.map((a, i) => (
                <p key={i} className="text-amber-400 text-sm">⚠️ {String(a.message ?? JSON.stringify(a))}</p>
              ))}
            </div>
          )}

          {/* KPI Row */}
          <SectionHeader title="Revenue Health" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard
              label="Health Score"
              value={facts.health_score != null ? (Number(facts.health_score) * 100).toFixed(0) + "%" : "—"}
              accentColor="#2563eb"
            />
            <MetricCard
              label="Churn Risk"
              value={facts.churn_probability != null ? (Number(facts.churn_probability) * 100).toFixed(1) + "%" : "—"}
              deltaPositive={false}
              accentColor="#ef4444"
            />
            <MetricCard
              label="Revenue Drop"
              value={facts.revenue_drop_pct != null ? `${Number(facts.revenue_drop_pct).toFixed(1)}%` : "—"}
              deltaPositive={false}
              accentColor="#f59e0b"
            />
            <MetricCard
              label="Recency (days)"
              value={facts.recency_days != null ? String(facts.recency_days) : "—"}
              accentColor="#8b5cf6"
            />
          </div>

          {/* Churn & Credit Bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="glass p-5">
              <p className="text-sm font-semibold text-white mb-1">Churn Probability</p>
              <p className="text-xs text-[#6b7280] mb-2">Risk band: <span className="text-amber-400 font-medium">{String(facts.churn_risk_band ?? "—")}</span></p>
              <Gauge value={Number(facts.churn_probability ?? 0)} color="#ef4444" />
            </div>
            <div className="glass p-5">
              <p className="text-sm font-semibold text-white mb-1">Credit Risk</p>
              <p className="text-xs text-[#6b7280] mb-2">Band: <span className="text-amber-400 font-medium">{String(facts.credit_risk_band ?? "—")}</span></p>
              <Gauge value={Number(facts.credit_risk_score ?? 0)} color="#f59e0b" />
            </div>
          </div>

          {/* Revenue Chart */}
          {monthly && monthly.length > 0 && (
            <>
              <SectionHeader title="Revenue Trend" />
              <div className="glass p-5 mb-6">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={monthly} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="sale_month" tick={{ fill: "#6b7280", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* Gap Table */}
          {gaps && gaps.length > 0 && (
            <>
              <SectionHeader title="Product Gaps (Upsell Opportunities)" />
              <div className="glass overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      {Object.keys(gaps[0]).slice(0, 6).map(k => <th key={k}>{k.replace(/_/g, " ")}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {gaps.slice(0, 10).map((row, i) => (
                      <tr key={i}>
                        {Object.keys(gaps[0]).slice(0, 6).map(k => (
                          <td key={k} className="text-[#d1d5db]">{String((row as Record<string, unknown>)[k] ?? "—")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
