"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DS } from "@/components/ui";
import { Panel, PanelHeader, SectionLabel, MetricCard, LoadingSkeleton, ErrorBanner, EmptyState, Btn, GaugeBar } from "@/components/ui";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Package, Phone, Calendar, AlertTriangle, Download, Search, X, Printer } from "lucide-react";

const TT = { background: "#fff", border: "1px solid rgba(199,196,216,0.3)", borderRadius: 10, fontSize: 11, boxShadow: "0 4px 16px rgba(25,28,30,0.08)" };

// exposure score formula: 0.6×age_factor + 0.4×qty_factor
function getPriority(score: number): { label: string; color: string; badge: string; desc: string } {
  if (score >= 70) return { label: "High Priority",   color: DS.red,   badge: "badge-red",   desc: "Liquidate Immediately" };
  if (score >= 40) return { label: "Medium Priority", color: DS.amber, badge: "badge-amber", desc: "Plan Sales Campaign" };
  return                   { label: "Low Priority",   color: DS.green, badge: "badge-green", desc: "Monitor" };
}

function fmt(n: unknown): string {
  const num = Number(n);
  if (!n && n !== 0) return "—";
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
  if (num >= 100000)   return `₹${(num / 100000).toFixed(1)}L`;
  return `₹${num.toFixed(0)}`;
}

function callScript(partnerName: string, productName: string, lastDate: string): string {
  const months = Math.floor((Date.now() - new Date(lastDate).getTime()) / 2592000000);
  if (months <= 3)  return `"Hi ${partnerName}, you recently purchased ${productName} with us. We have additional stock available at a special rate this week — would you like to add it to your current order?"`;
  if (months <= 12) return `"Hi ${partnerName}, you purchased ${productName} around ${months} months back. We're running a clearance campaign — I'd love to offer you preferential pricing before it goes to general market."`;
  return `"Hi ${partnerName}, you used to carry ${productName}. We have a refresh opportunity with competitive pricing. Should we discuss a trial order?"`;
}

// ── CSV export ─────────────────────────────────────────────────────────────
function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(","), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Searchable product dropdown ───────────────────────────────────────────
type ProductItem = { name: string; age: number; qty: number };
function ProductSearch({ items, value, onChange }: { items: ProductItem[]; value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const filtered = query.length < 1
    ? items.slice(0, 50)
    : items.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 50);

  useEffect(() => {
    function onOut(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, []);

  function ageBadgeColor(age: number) { return age > 90 ? DS.red : age > 60 ? DS.amber : DS.green; }

  return (
    <div ref={ref} style={{ position: "relative", flex: 1 }}>
      <div style={{ position: "relative" }}>
        <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: DS.textMuted, pointerEvents: "none" }} />
        <input className="form-input" style={{ paddingLeft: 30, paddingRight: value ? 30 : undefined }}
          placeholder="Search dead stock product…" value={query}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); onChange(""); }}
        />
        {value && (
          <button onClick={() => { onChange(""); setQuery(""); setOpen(false); }}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: DS.textMuted }}>
            <X size={12} />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 300,
          background: "#fff", borderRadius: 10, boxShadow: "0 8px 32px rgba(25,28,30,0.14)",
          border: "1px solid rgba(199,196,216,0.25)", maxHeight: 260, overflowY: "auto",
        }}>
          {filtered.map(p => (
            <div key={p.name}
              onClick={() => { onChange(p.name); setQuery(p.name); setOpen(false); }}
              style={{
                padding: "9px 14px", fontSize: 12.5, cursor: "pointer",
                background: p.name === value ? "#eef0ff" : "transparent",
                borderBottom: "1px solid rgba(199,196,216,0.1)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => { if (p.name !== value) e.currentTarget.style.background = "#f7f9fb"; }}
              onMouseLeave={e => { if (p.name !== value) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontWeight: p.name === value ? 700 : 400, color: DS.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
              <div style={{ display: "flex", gap: 6, marginLeft: 10, flexShrink: 0 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: ageBadgeColor(p.age), background: ageBadgeColor(p.age) + "15", padding: "2px 6px", borderRadius: 4 }}>{p.age}d old</span>
                <span style={{ fontSize: 9.5, color: DS.textMuted, background: "#f0f0f0", padding: "2px 6px", borderRadius: 4 }}>{p.qty} units</span>
              </div>
            </div>
          ))}
          {items.length > 50 && (
            <p style={{ padding: "6px 14px", fontSize: 10, color: DS.textMuted, borderTop: "1px solid rgba(199,196,216,0.2)" }}>
              Showing 50 of {items.length} — type to narrow
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Call Script Modal ─────────────────────────────────────────────────────
function ScriptModal({ buyer, product, onClose }: { buyer: Record<string, unknown>; product: string; onClose: () => void }) {
  const name = String(buyer.buyer_name ?? buyer.partner_name ?? "Partner");
  const lastDate = String(buyer.last_purchase_date ?? "");
  const script = callScript(name, product, lastDate);
  const mobile = String(buyer.mobile_no ?? buyer.contact ?? "");

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,12,53,0.45)", backdropFilter: "blur(3px)" }} />
      <div style={{
        position: "relative", background: "#fff", borderRadius: 18, padding: 28, maxWidth: 520, width: "90%",
        boxShadow: "0 24px 80px rgba(25,28,30,0.25)", animation: "scaleIn 0.18s ease-out",
      }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "#f3f4f6", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X size={14} color={DS.textMuted} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: DS.primary + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Phone size={16} color={DS.primary} />
          </div>
          <div>
            <p style={{ fontWeight: 800, fontSize: 14, color: DS.text, margin: 0 }}>📞 Call Script — {name}</p>
            {mobile && <p style={{ fontSize: 11, color: DS.textMuted, margin: 0, marginTop: 2 }}>📱 {mobile}</p>}
          </div>
        </div>

        <div style={{ background: "#f7f9fb", borderRadius: 10, padding: "14px 16px", borderLeft: `4px solid ${DS.primary}`, marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: DS.text, lineHeight: 1.75, fontStyle: "italic" }}>{script}</p>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn variant="ghost" size="sm" onClick={onClose}>Close</Btn>
          {mobile && (
            <a href={`tel:${mobile}`} style={{ textDecoration: "none" }}>
              <Btn variant="primary" size="sm"><Phone size={11} />Call Now</Btn>
            </a>
          )}
          <Btn variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(script)}>Copy Script</Btn>
        </div>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [selectedItem, setSelectedItem] = useState("");
  const [discount, setDiscount] = useState(10);
  const [scriptBuyer, setScriptBuyer] = useState<Record<string, unknown> | null>(null);

  const { data: deadStockData, isLoading: listLoading } = useQuery({ queryKey: ["dead-stock"], queryFn: api.inventory.deadStock });
  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["stock-detail", selectedItem],
    queryFn: () => api.inventory.stockDetails(selectedItem),
    enabled: !!selectedItem,
  });

  const items = (deadStockData?.items ?? []) as Record<string, unknown>[];
  const detailFacts = (detailData?.facts ?? {}) as Record<string, unknown>;
  const buyers = (detailData?.buyers ?? []) as Record<string, unknown>[];

  const score = Number(detailFacts.stock_exposure_score ?? detailFacts.exposure_score ?? 0);
  const priority = getPriority(score);

  const selectedItemData = items.find(x => String(x.product_name ?? x.item_name) === selectedItem) ?? {};
  const maxAge = Number(selectedItemData.max_age_days ?? detailFacts.max_age_days ?? 0);
  const qty = Number(selectedItemData.total_stock_qty ?? detailFacts.total_stock_qty ?? 0);
  const agePct = Number(detailFacts.age_percentile ?? 0);
  const effAge = Number(detailFacts.effective_age ?? maxAge);
  const demandRecency = Number(detailFacts.demand_recency_days ?? 0);

  // Product items for searchable dropdown
  const productItems: ProductItem[] = items.map(it => ({
    name: String(it.product_name ?? it.item_name ?? ""),
    age: Number(it.max_age_days ?? 0),
    qty: Number(it.total_stock_qty ?? 0),
  }));

  // ── Stock aging chart buckets (across all items) ─────────────────────────
  const agingBuckets = [
    { label: "0–30d",  count: items.filter(i => Number(i.max_age_days ?? 0) <= 30).length,  color: DS.green },
    { label: "31–60d", count: items.filter(i => { const a = Number(i.max_age_days ?? 0); return a > 30 && a <= 60; }).length, color: DS.blue },
    { label: "61–90d", count: items.filter(i => { const a = Number(i.max_age_days ?? 0); return a > 60 && a <= 90; }).length, color: DS.amber },
    { label: "90d+",   count: items.filter(i => Number(i.max_age_days ?? 0) > 90).length,    color: DS.red },
  ];

  // ── Batch export: buyer list with call scripts ────────────────────────────
  function handleBatchExport() {
    const rows = buyers.map((b, i) => ({
      "#": i + 1,
      partner_name: String(b.buyer_name ?? b.partner_name ?? ""),
      mobile: String(b.mobile_no ?? b.contact ?? ""),
      last_purchase_date: String(b.last_purchase_date ?? ""),
      past_qty: Number(b.buyer_past_purchase_qty ?? b.quantity ?? 0),
      call_script: callScript(String(b.buyer_name ?? "Partner"), selectedItem, String(b.last_purchase_date ?? "")),
    }));
    downloadCSV(rows, `${selectedItem.replace(/\s/g, "_")}_buyer_outreach.csv`);
  }

  if (listLoading) return <LoadingSkeleton lines={4} />;

  return (
    <div style={{ animation: "fadeIn 0.25s ease-out" }}>
      {/* Hero */}
      <div className="page-hero" style={{ "--hero-accent": DS.amber } as React.CSSProperties}>
        <span className="page-hero-icon">📦</span>
        <div>
          <div className="page-hero-title">Inventory Liquidation</div>
          <div className="page-hero-sub">Dead stock identification and warm buyer outreach — targeting partners who've historically purchased each slow-moving item.</div>
        </div>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {selectedItem && buyers.length > 0 && (
            <Btn variant="outline" size="sm" onClick={handleBatchExport}><Download size={11} />Export Buyers CSV</Btn>
          )}
        </span>
      </div>

      {/* Dead stock alert */}
      {items.length > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: DS.amberBg, border: `1px solid ${DS.amber}22`, borderRadius: 10, marginBottom: 20 }}>
          <AlertTriangle size={14} color={DS.amber} />
          <p style={{ margin: 0, fontSize: 13, color: DS.text }}>
            <strong style={{ color: DS.amber }}>{items.length} products</strong> flagged as dead stock (age &gt;60d, qty &gt;10 units) — select one to generate outreach plan.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: DS.greenBg, borderRadius: 10, marginBottom: 20 }}>
          <span style={{ color: DS.green, fontWeight: 700 }}>✓</span>
          <p style={{ margin: 0, fontSize: 13, color: DS.green, fontWeight: 600 }}>No dead stock items found — inventory is healthy!</p>
        </div>
      )}

      {/* ── Stock Aging Chart ─────────────────────────────────────────────── */}
      {items.length > 0 && (
        <>
          <SectionLabel>Stock Aging Distribution</SectionLabel>
          <Panel style={{ marginBottom: 20 }}>
            <PanelHeader title="Products by Age Bucket" subtitle={`${items.length} total dead stock items across 4 age groups`} />
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 0 }}>
              {/* KPI pills */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 16px 12px 20px", justifyContent: "center" }}>
                {agingBuckets.map(b => (
                  <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: b.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: DS.textMuted, minWidth: 46 }}>{b.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: b.color }}>{b.count}</span>
                  </div>
                ))}
              </div>
              {/* Bar chart */}
              <div style={{ padding: "8px 16px 12px 0" }}>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={agingBuckets} margin={{ left: 5, right: 10, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(199,196,216,0.15)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TT} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Products">
                      {agingBuckets.map((b, i) => <Cell key={i} fill={b.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Panel>
        </>
      )}

      {/* ── Searchable Product Selector ───────────────────────────────────── */}
      <Panel style={{ marginBottom: 20 }}>
        <div style={{ padding: "14px 18px" }}>
          <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.textMuted, marginBottom: 8 }}>
            Select Dead Stock Product
            {items.length > 0 && <span style={{ color: DS.primary, marginLeft: 6 }}>({items.length} items)</span>}
          </p>
          <ProductSearch items={productItems} value={selectedItem} onChange={setSelectedItem} />
          {selectedItem && (
            <p style={{ fontSize: 10.5, color: DS.textMuted, marginTop: 6 }}>
              📦 <b>{selectedItem}</b> · {maxAge > 0 ? `${maxAge}d old` : "—"} · {qty > 0 ? `${qty.toLocaleString()} units` : "—"}
            </p>
          )}
        </div>
      </Panel>

      {!selectedItem && <EmptyState message="Select a product to see stock metrics, exposure score, and target buyer list." />}
      {detailLoading && <LoadingSkeleton lines={4} />}

      {selectedItem && !detailLoading && (
        <>
          {/* Stock Metrics */}
          <SectionLabel>Stock Health Metrics</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 8 }}>
            <MetricCard label="Total Stock Left" value={`${qty.toLocaleString()} units`} icon={<Package size={14} />} color={DS.amber} />
            <div style={{ background: DS.card, borderRadius: 12, padding: "1.25rem 1.375rem", boxShadow: DS.shadow }}>
              <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.textMuted, margin: 0 }}>Max Age</p>
              <p style={{ fontFamily: "'Manrope',sans-serif", fontSize: "1.875rem", fontWeight: 800, color: DS.text, letterSpacing: "-0.03em", lineHeight: 1.1, marginTop: 8 }}>{maxAge}d</p>
              {agePct > 0 && <p style={{ fontSize: 10.5, color: DS.textMuted, marginTop: 4 }}>P{agePct.toFixed(0)} in portfolio</p>}
              {!!effAge && effAge !== maxAge && <p style={{ fontSize: 10, color: DS.textMuted, marginTop: 2 }}>Effective: {effAge}d</p>}
            </div>
            <div style={{ background: priority.color + "10", borderRadius: 12, padding: "1.25rem 1.375rem", boxShadow: DS.shadow }}>
              <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.textMuted, margin: 0 }}>Exposure Score</p>
              <p style={{ fontFamily: "'Manrope',sans-serif", fontSize: "1.875rem", fontWeight: 800, color: priority.color, letterSpacing: "-0.03em", lineHeight: 1.1, marginTop: 8 }}>{score.toFixed(0)}/100</p>
              <GaugeBar pct={score} color={priority.color} />
              <p style={{ fontSize: 9.5, color: DS.textMuted, marginTop: 4 }}>0.6×age + 0.4×qty</p>
            </div>
            <div style={{ background: priority.color + "08", borderRadius: 12, padding: "1.25rem 1.375rem", boxShadow: DS.shadow }}>
              <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.textMuted, margin: 0 }}>Priority</p>
              <p style={{ fontFamily: "'Manrope',sans-serif", fontSize: "1.5rem", fontWeight: 800, color: priority.color, letterSpacing: "-0.02em", lineHeight: 1.1, marginTop: 8 }}>{priority.label}</p>
              <span className={`badge ${priority.badge}`} style={{ marginTop: 6, fontSize: 10 }}>{priority.desc}</span>
              {demandRecency > 0 && <p style={{ fontSize: 10, color: DS.textMuted, marginTop: 4 }}>Last buyer: {demandRecency}d ago</p>}
            </div>
          </div>

          {/* Clearance Campaign */}
          <SectionLabel>Clearance Campaign Simulator</SectionLabel>
          <Panel style={{ marginBottom: 20 }}>
            <PanelHeader title="Suggested Discount Strategy" subtitle="Value pitch auto-generated per partner" />
            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.textMuted, display: "block", marginBottom: 8 }}>
                    Proposed Discount: {discount}%
                  </label>
                  <input type="range" min={5} max={40} step={5} value={discount} onChange={e => setDiscount(Number(e.target.value))} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: DS.textMuted, marginTop: 4 }}><span>5%</span><span>40%</span></div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ background: DS.primaryFix, borderRadius: 10, padding: "10px 14px", flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 10.5, color: DS.textMuted }}>Est. Revenue Recovery</p>
                    <p style={{ margin: "4px 0 0", fontFamily: "'Manrope',sans-serif", fontSize: 18, fontWeight: 800, color: DS.primary }}>
                      {fmt(qty * (1 - discount / 100) * Number(detailFacts.unit_price ?? detailFacts.avg_price ?? 0))}
                    </p>
                  </div>
                  <div style={{ background: DS.greenBg, borderRadius: 10, padding: "10px 14px", flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 10.5, color: DS.textMuted }}>Space Freed (units)</p>
                    <p style={{ margin: "4px 0 0", fontFamily: "'Manrope',sans-serif", fontSize: 18, fontWeight: 800, color: DS.green }}>{qty.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          {/* Target Buyers Table */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <SectionLabel>Target Buyers — Historical Purchasers ({buyers.length})</SectionLabel>
            {buyers.length > 0 && (
              <Btn variant="outline" size="sm" onClick={handleBatchExport}>
                <Download size={10} />Export Call Sheet CSV
              </Btn>
            )}
          </div>
          {buyers.length === 0 ? (
            <div style={{ padding: "16px", background: DS.amberBg, borderRadius: 10, border: `1px solid ${DS.amber}22` }}>
              <p style={{ margin: 0, fontSize: 12.5, color: DS.amber, fontWeight: 600 }}>⚠ No buyers found for this product — consider broader market outreach.</p>
            </div>
          ) : (
            <Panel>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr>
                    <th>#</th>
                    <th>Partner Name</th>
                    <th>Contact</th>
                    <th>Past Qty</th>
                    <th>Last Purchase</th>
                    <th>Recency</th>
                    <th>Call Script</th>
                  </tr></thead>
                  <tbody>
                    {buyers.map((b, i) => {
                      const name = String(b.buyer_name ?? b.partner_name ?? "—");
                      const mobile = String(b.mobile_no ?? b.contact ?? "N/A");
                      const qty2 = Number(b.buyer_past_purchase_qty ?? b.quantity ?? 0);
                      const lastDate = String(b.last_purchase_date ?? "");
                      const months = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 2592000000) : -1;
                      return (
                        <tr key={i}>
                          <td style={{ color: DS.textMuted, width: 32, fontSize: 10 }}>{i + 1}</td>
                          <td style={{ fontWeight: 700, color: DS.text }}>{name}</td>
                          <td>
                            <a href={`tel:${mobile}`} style={{ display: "flex", alignItems: "center", gap: 5, textDecoration: "none", color: DS.primary }}>
                              <Phone size={10} />
                              <span style={{ fontSize: 11 }}>{mobile}</span>
                            </a>
                          </td>
                          <td style={{ fontWeight: 600, color: DS.primary }}>{qty2.toLocaleString()} units</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <Calendar size={10} color={DS.textMuted} />
                              <span style={{ fontSize: 11 }}>{lastDate || "—"}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${months >= 0 && months <= 3 ? "badge-green" : months <= 12 ? "badge-amber" : "badge-gray"}`} style={{ fontSize: 9.5 }}>
                              {months < 0 ? "—" : months <= 3 ? "Recent" : `${months}mo ago`}
                            </span>
                          </td>
                          <td>
                            <button onClick={() => setScriptBuyer(b)}
                              style={{
                                fontSize: 10.5, background: DS.primaryFix, color: DS.primary,
                                border: "none", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 600,
                                transition: "all 0.1s",
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = DS.primary + "25"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = DS.primaryFix; }}>
                              📞 View Script
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}

      {/* Call Script Modal */}
      {scriptBuyer && (
        <ScriptModal
          buyer={scriptBuyer}
          product={selectedItem}
          onClose={() => setScriptBuyer(null)}
        />
      )}
    </div>
  );
}
