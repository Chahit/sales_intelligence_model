"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, Skeleton, ErrorBanner, SectionHeader } from "@/components/ui";

export default function MarketBasketPage() {
  const [minConf, setMinConf] = useState(0.15);
  const [minLift, setMinLift] = useState(1.0);
  const [minSupport, setMinSupport] = useState(5);
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState({ minConf: 0.15, minLift: 1.0, minSupport: 5, search: "" });

  const { data, isLoading, error } = useQuery({
    queryKey: ["mba-rules", submitted],
    queryFn: () => api.marketBasket.rules({
      min_confidence: submitted.minConf,
      min_lift: submitted.minLift,
      min_support: submitted.minSupport,
      search: submitted.search || undefined,
    }),
  });

  const rows = data?.rows ?? [];

  if (error) return <ErrorBanner message="Could not load market basket rules." />;

  return (
    <div>
      <PageHeader
        icon="🛒"
        title="Market Basket Analysis"
        subtitle="Discover product bundle rules and partner-specific cross-sell opportunities."
        accentColor="#0891b2"
        badge="FP-Growth"
      />

      {/* Filters */}
      <div className="glass p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-[#6b7280] mb-1 block">Search Product</label>
            <input type="text" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white" value={search} onChange={e => setSearch(e.target.value)} placeholder="e.g. Inverter" />
          </div>
          <div>
            <label className="text-xs text-[#6b7280] mb-1 block">Min Confidence: {minConf.toFixed(2)}</label>
            <input type="range" min={0} max={1} step={0.01} value={minConf} onChange={e => setMinConf(Number(e.target.value))} className="w-full accent-cyan-500" />
          </div>
          <div>
            <label className="text-xs text-[#6b7280] mb-1 block">Min Lift: {minLift.toFixed(1)}</label>
            <input type="range" min={0} max={5} step={0.1} value={minLift} onChange={e => setMinLift(Number(e.target.value))} className="w-full accent-cyan-500" />
          </div>
          <div>
            <label className="text-xs text-[#6b7280] mb-1 block">Min Support: {minSupport}</label>
            <input type="range" min={1} max={50} step={1} value={minSupport} onChange={e => setMinSupport(Number(e.target.value))} className="w-full accent-cyan-500" />
          </div>
        </div>
        <button
          onClick={() => setSubmitted({ minConf, minLift, minSupport, search })}
          className="mt-3 px-4 py-2 text-sm font-medium rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition"
        >
          Apply Filters
        </button>
      </div>

      <SectionHeader title={`Association Rules (${data?.total ?? 0} found)`} />
      {isLoading ? <Skeleton className="h-48" /> : (
        <div className="glass overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product A (If Bought)</th>
                <th>Product B (Also Buy)</th>
                <th>Confidence A→B</th>
                <th>Lift</th>
                <th>Support A</th>
                <th>Support B</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((row, i) => {
                const r = row as Record<string, unknown>;
                const lift = Number(r.lift_a_to_b ?? 0);
                const conf = Number(r.confidence_a_to_b ?? 0);
                return (
                  <tr key={i}>
                    <td className="text-white font-medium">{String(r.product_a ?? "—")}</td>
                    <td className="text-indigo-400 font-medium">{String(r.product_b ?? "—")}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-white/[0.05] rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-cyan-500" style={{ width: `${Math.min(conf * 100, 100)}%` }} />
                        </div>
                        <span className="text-[#d1d5db] text-xs">{conf.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className={lift >= 2 ? "text-emerald-400 font-bold" : lift >= 1.5 ? "text-amber-400" : "text-[#d1d5db]"}>{lift.toFixed(2)}</td>
                    <td className="text-[#9ca3af]">{String(r.support_a ?? "—")}</td>
                    <td className="text-[#9ca3af]">{String(r.support_b ?? "—")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
