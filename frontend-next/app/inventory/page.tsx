"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, Skeleton, ErrorBanner, SectionHeader } from "@/components/ui";

export default function InventoryPage() {
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [discount, setDiscount] = useState(20);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dead-stock"],
    queryFn: () => api.inventory.deadStock(),
  });

  const items = data?.items ?? [];
  const itemNames = data?.item_names ?? [];

  const selectedRow = items.find((r) => {
    const name = (r as Record<string, unknown>).product_name ?? (r as Record<string, unknown>).item_name;
    return String(name) === selectedItem;
  }) as Record<string, unknown> | undefined;

  const currRev = selectedRow ? Number(selectedRow.current_revenue ?? selectedRow.avg_monthly_revenue ?? 0) : 0;

  if (error) return <ErrorBanner message="Could not load inventory data." />;

  return (
    <div>
      <PageHeader
        icon="📦"
        title="Inventory Liquidation"
        subtitle="Identify dead / slow-moving stock and generate clearance offers."
        accentColor="#dc2626"
      />

      {isLoading ? <Skeleton className="h-64" /> : (
        <>
          {/* Item selector */}
          <div className="mb-4">
            <label className="text-xs text-[#6b7280] mb-1 block font-medium uppercase tracking-wider">Select Item</label>
            <select
              className="w-full max-w-md bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50"
              value={selectedItem}
              onChange={e => setSelectedItem(e.target.value)}
            >
              <option value="">Choose item…</option>
              {itemNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {/* Clearance Generator */}
          {selectedRow && (
            <>
              <SectionHeader title="Clearance Action Generator" />
              <div className="glass p-5 mb-6">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-[#6b7280] mb-1">Discount %</p>
                    <input
                      type="range" min={5} max={50} step={5}
                      value={discount} onChange={e => setDiscount(Number(e.target.value))}
                      className="w-full accent-red-500"
                    />
                    <p className="text-lg font-bold text-red-400 mt-1">{discount}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#6b7280] mb-1">Clearance Rev / Mo</p>
                    <p className="text-xl font-bold text-white">₹{(currRev * (1 - discount / 100)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#6b7280] mb-1">Original Rev / Mo</p>
                    <p className="text-xl font-bold text-[#9ca3af]">₹{currRev.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
                  </div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-sm text-amber-300">
                  <p className="font-semibold mb-1">📣 Flash Deal Script</p>
                  <p>
                    Dear Partner, we have a special <strong>{discount}% discount</strong> on{" "}
                    <strong>{selectedItem}</strong>. Act fast — limited stock available! Contact your sales rep today.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Dead Stock Table */}
          <SectionHeader title="Dead Stock Register" />
          <div className="glass overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Stock Qty</th>
                  <th>Avg Monthly Rev</th>
                  <th>Max Age (days)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 50).map((row, i) => {
                  const r = row as Record<string, unknown>;
                  return (
                    <tr key={i} className={String(r.product_name ?? r.item_name) === selectedItem ? "bg-red-500/10" : ""}>
                      <td className="text-white font-medium">{String(r.product_name ?? r.item_name ?? "—")}</td>
                      <td className="text-[#d1d5db]">{String(r.total_stock_qty ?? r.stock_qty ?? "—")}</td>
                      <td className="text-[#d1d5db]">₹{Number(r.avg_monthly_revenue ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                      <td className="text-[#d1d5db]">{String(r.max_age_days ?? "—")}</td>
                      <td>
                        <button
                          className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
                          onClick={() => setSelectedItem(String(r.product_name ?? r.item_name ?? ""))}
                        >
                          Select
                        </button>
                      </td>
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
