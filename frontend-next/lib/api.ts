/**
 * Central API client — all fetch calls against the FastAPI backend.
 * Base URL is configurable via NEXT_PUBLIC_API_URL env variable.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

// ── Partner ───────────────────────────────────────────────────────────────────
export const api = {
  partner: {
    states: () => get<{ states: string[] }>("/api/partner/states"),
    list: (state: string) => get<{ partners: string[] }>("/api/partner/list", { state }),
    intelligence: (name: string) => get<Record<string, unknown>>(`/api/partner/${encodeURIComponent(name)}`),
  },

  // ── Clustering ─────────────────────────────────────────────────────────────
  clustering: {
    summary: () => get<Record<string, unknown>>("/api/clustering/summary"),
    matrix: () => get<Record<string, unknown>>("/api/clustering/matrix"),
  },

  // ── Inventory ──────────────────────────────────────────────────────────────
  inventory: {
    deadStock: () => get<{ status: string; item_names: string[]; items: Record<string, unknown>[] }>("/api/inventory/dead-stock"),
    stockDetails: (item: string) => get<Record<string, unknown>>(`/api/inventory/stock-details/${encodeURIComponent(item)}`),
  },

  // ── Product Lifecycle ──────────────────────────────────────────────────────
  lifecycle: {
    summary: () => get<Record<string, unknown>>("/api/lifecycle/summary"),
    velocity: (stage?: string) => get<{ rows: Record<string, unknown>[] }>("/api/lifecycle/velocity", { stage }),
    eol: (urgency?: string) => get<{ rows: Record<string, unknown>[] }>("/api/lifecycle/eol", { urgency }),
    cannibalization: () => get<{ rows: Record<string, unknown>[] }>("/api/lifecycle/cannibalization"),
    trend: (product: string) => get<{ rows: Record<string, unknown>[] }>(`/api/lifecycle/trend/${encodeURIComponent(product)}`),
  },

  // ── Recommendations ────────────────────────────────────────────────────────
  recommendations: {
    plan: (partnerName: string, topN = 3) =>
      get<Record<string, unknown>>("/api/recommendations/plan", { partner_name: partnerName, top_n: topN }),
    nlQuery: (query: string, stateScope?: string, topN = 20) =>
      post<Record<string, unknown>>("/api/recommendations/nl-query", { query, state_scope: stateScope, top_n: topN }),
    pitchScript: (partnerName: string, sequence: number, tone: string) =>
      get<Record<string, unknown>>("/api/recommendations/pitch-script", { partner_name: partnerName, action_sequence: sequence, tone }),
    followup: (partnerName: string, sequence: number, days: number, qty: number, tone: string) =>
      get<Record<string, unknown>>("/api/recommendations/followup-script", {
        partner_name: partnerName, action_sequence: sequence,
        no_conversion_days: days, trial_qty: qty, tone,
      }),
    bundles: (partnerName: string, topN = 5) =>
      get<{ rows: Record<string, unknown>[] }>("/api/recommendations/bundles", { partner_name: partnerName, top_n: topN }),
  },

  // ── Sales Rep ──────────────────────────────────────────────────────────────
  salesRep: {
    leaderboard: () => get<{ rows: Record<string, unknown>[] }>("/api/sales-rep/leaderboard"),
    monthlyRevenue: (repId: number) => get<{ rows: Record<string, unknown>[] }>("/api/sales-rep/monthly-revenue", { rep_id: repId }),
  },

  // ── Market Basket ──────────────────────────────────────────────────────────
  marketBasket: {
    rules: (params?: { min_confidence?: number; min_lift?: number; min_support?: number; search?: string; include_low_support?: boolean }) =>
      get<{ rows: Record<string, unknown>[]; total: number }>("/api/market-basket/rules", params),
    crossSell: (product: string, topN = 5) =>
      get<{ rows: Record<string, unknown>[] }>(`/api/market-basket/cross-sell/${encodeURIComponent(product)}`, { top_n: topN }),
    partnerRecs: (partner: string, params?: { min_confidence?: number; min_lift?: number; min_support?: number; top_n?: number }) =>
      get<{ rows: Record<string, unknown>[] }>("/api/market-basket/partner-recs", { partner_name: partner, ...params }),
  },

  // ── Pipeline ───────────────────────────────────────────────────────────────
  pipeline: {
    kanban: () => get<{ lanes: Record<string, unknown>[] }>("/api/pipeline/kanban"),
    partners: (params?: { state?: string; credit_risk?: string; sort_by?: string; min_revenue?: number; search?: string }) =>
      get<{ rows: Record<string, unknown>[]; summary: Record<string, unknown> }>("/api/pipeline/partners", params),
  },

  // ── Chat ───────────────────────────────────────────────────────────────────
  chat: {
    query: (query: string) => post<{ status: string; answer: string }>("/api/chat/query", { query }),
  },

  // ── Monitoring ─────────────────────────────────────────────────────────────
  monitoring: {
    snapshot: () => get<Record<string, unknown>>("/api/monitoring/snapshot"),
    alerts: (limit = 100) => get<Record<string, unknown>>("/api/monitoring/alerts", { limit }),
    dataQuality: () => get<Record<string, unknown>>("/api/monitoring/data-quality"),
    clusterQuality: () => get<Record<string, unknown>>("/api/monitoring/cluster-quality"),
    realtimeStatus: () => get<Record<string, unknown>>("/api/monitoring/realtime-status"),
  },
};
