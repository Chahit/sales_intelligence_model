import streamlit as st
import pandas as pd
import numpy as np
import sys, os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from styles import page_header, skeleton_loader

# ── Kanban swimlane configuration ──────────────────────────────────────────
LANES = [
    {"key": "champion", "label": "🏆 Champion", "segments": {"Champion"}, "color": "#22c55e"},
    {"key": "healthy",  "label": "✅ Healthy",  "segments": {"Healthy"},  "color": "#3b82f6"},
    {"key": "at_risk",  "label": "⚠️ At Risk",  "segments": {"At Risk"},  "color": "#f59e0b"},
    {"key": "critical", "label": "🔴 Critical", "segments": {"Critical"}, "color": "#ef4444"},
]

def _fmt_inr(val):
    try:
        v = float(val)
    except Exception:
        return "₹0"
    if v >= 1_00_00_000: return f"₹{v / 1_00_00_000:.1f}Cr"
    if v >= 1_00_000:    return f"₹{v / 1_00_000:.1f}L"
    if v >= 1_000:       return f"₹{v / 1_000:.0f}K"
    return f"₹{v:.0f}"

# ── Cache the heavy data slice so repeated renders are fast ────────────────
@st.cache_data(ttl=300, show_spinner=False)
def _build_kanban_df(_pf_df):
    """Extract and pre-process only the columns needed by the Kanban board."""
    needed = [
        "company_name", "state", "health_segment", "health_status",
        "churn_probability", "credit_risk_band",
        "recent_90_revenue", "revenue_drop_pct",
    ]
    df = _pf_df.reset_index()
    if "company_name" not in df.columns and "index" in df.columns:
        df = df.rename(columns={"index": "company_name"})
    cols_present = [c for c in needed if c in df.columns]
    df = df[cols_present].copy()
    # Fill defaults for optional columns
    if "churn_probability" not in df.columns:
        df["churn_probability"] = 0.0
    if "credit_risk_band" not in df.columns:
        df["credit_risk_band"] = "N/A"
    if "health_segment" not in df.columns:
        df["health_segment"] = "Healthy"
    df["churn_probability"] = pd.to_numeric(df["churn_probability"], errors="coerce").fillna(0.0)
    df["recent_90_revenue"] = pd.to_numeric(df.get("recent_90_revenue", 0), errors="coerce").fillna(0.0)
    return df


def render(ai):
    page_header(
        title="Revenue Pipeline Tracker",
        subtitle="Monitor partner health across every stage — Champion, Healthy, At Risk, and Critical.",
        icon="📊",
        accent_color="#6366f1",
    )
    skel = st.empty()
    with skel.container():
        skeleton_loader(n_metric_cards=4, n_rows=2, label="Loading pipeline data...")

    # Load clustering (fast, cached) and optionally churn/credit
    ai.ensure_clustering()
    if getattr(ai, "enable_realtime_partner_scoring", False):
        try:
            ai.ensure_churn_forecast()
            ai.ensure_credit_risk()
        except Exception:
            pass

    skel.empty()

    pf = getattr(ai, "df_partner_features", None)
    if pf is None or pf.empty:
        st.warning("Partner features not available. Run the clustering engine first.")
        return

    # Use cached, lightweight slice
    df = _build_kanban_df(pf)

    # ── Sidebar filters ─────────────────────────────────────────────────────
    st.sidebar.markdown("---")
    st.sidebar.markdown("**🔍 Pipeline Filters**")

    all_states = sorted(df["state"].dropna().unique().tolist()) if "state" in df.columns else []
    sel_states = st.sidebar.multiselect("Filter by State", all_states, default=[], key="kb_states")
    if sel_states:
        df = df[df["state"].isin(sel_states)]

    credit_opts = ["All", "Low", "Medium", "High", "Critical"]
    sel_credit  = st.sidebar.selectbox("Filter by Credit Risk", credit_opts, key="kb_credit")
    if sel_credit != "All" and "credit_risk_band" in df.columns:
        df = df[df["credit_risk_band"] == sel_credit]

    sort_by = st.sidebar.selectbox(
        "Sort cards by",
        ["Revenue (High→Low)", "Churn Risk (High→Low)", "Name (A→Z)"],
        key="kb_sort",
    )

    min_rev = st.sidebar.number_input("Min 90d Revenue (₹)", value=0, step=10000, key="kb_minrev")
    if min_rev > 0:
        df = df[df["recent_90_revenue"] >= min_rev]

    search_query = st.text_input("🔍 Search partner by name", placeholder="Type a company name...", key="kb_search")
    if search_query.strip():
        df = df[df["company_name"].str.contains(search_query.strip(), case=False, na=False)]

    # ── Sort ────────────────────────────────────────────────────────────────
    if sort_by == "Revenue (High→Low)":
        df = df.sort_values("recent_90_revenue", ascending=False)
    elif sort_by == "Churn Risk (High→Low)":
        df = df.sort_values("churn_probability", ascending=False)
    else:
        df = df.sort_values("company_name")

    st.markdown("---")

    # ── Summary bar ─────────────────────────────────────────────────────────
    total_partners = len(df)
    high_churn     = int((df["churn_probability"] >= 0.65).sum())
    critical_cnt   = int((df.get("health_segment", pd.Series(dtype=str)) == "Critical").sum())
    total_revenue  = float(df["recent_90_revenue"].sum())

    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Partners in Pipeline", total_partners)
    m2.metric("High Churn Risk", high_churn,
              delta=f"{high_churn/max(total_partners,1)*100:.0f}% of Pipeline",
              delta_color="inverse")
    m3.metric("Critical Accounts", critical_cnt, delta_color="inverse")
    m4.metric("90d Pipeline Value", _fmt_inr(total_revenue))

    st.markdown("---")

    # ── Kanban Board ─────────────────────────────────────────────────────────
    cols = st.columns(len(LANES))

    for idx, lane in enumerate(LANES):
        col = cols[idx]
        mask = (
            df["health_segment"].isin(lane["segments"])
            if "health_segment" in df.columns
            else pd.Series(False, index=df.index)
        )
        lane_df = df[mask]
        lane_count = len(lane_df)
        lane_rev = float(lane_df["recent_90_revenue"].sum())

        with col:
            # Lane header
            st.markdown(
                f"""<div style="background:#1a1c23;padding:12px;border-top:4px solid {lane['color']};border-radius:8px;margin-bottom:12px;">
                    <h4 style="margin:0;font-size:15px;color:{lane['color']};">
                        {lane['label']} <span style="font-size:12px;color:#aaa;float:right;">({lane_count})</span>
                    </h4>
                    <div style="font-size:12px;color:#aaa;margin-top:4px;">Value: <b>{_fmt_inr(lane_rev)}</b></div>
                </div>""",
                unsafe_allow_html=True,
            )

            if lane_count == 0:
                st.info("Empty")
                continue

            # ── Cards: only render top 50 per lane for speed ──────────────
            shown = lane_df.head(50)
            for _, row in shown.iterrows():
                name      = str(row.get("company_name", "Unknown"))
                rev       = _fmt_inr(row.get("recent_90_revenue", 0))
                churn_raw = row.get("churn_probability", 0)
                churn_pct = f"{float(churn_raw)*100:.0f}%" if pd.notnull(churn_raw) else "—"
                credit    = str(row.get("credit_risk_band", "—"))
                state     = str(row.get("state", "—"))

                # Color-code churn severity
                if pd.notnull(churn_raw) and float(churn_raw) >= 0.7:
                    churn_color = "#ef4444"
                elif pd.notnull(churn_raw) and float(churn_raw) >= 0.5:
                    churn_color = "#f59e0b"
                else:
                    churn_color = "#22c55e"

                with st.expander(f"{name} — {rev}"):
                    st.markdown(
                        f"**State:** {state}  \n"
                        f"**Churn Risk:** <span style='color:{churn_color};font-weight:600'>{churn_pct}</span> &nbsp;|&nbsp; "
                        f"**Credit:** {credit}",
                        unsafe_allow_html=True,
                    )

            if lane_count > 50:
                st.caption(f"Showing top 50 of {lane_count}. Use filters to narrow down.")
