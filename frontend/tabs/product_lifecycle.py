import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from styles import apply_global_styles, section_header, page_caption


def render(ai):
    apply_global_styles()
    st.title("Product Lifecycle Intelligence")
    page_caption("Track product growth velocity, detect cannibalization, and predict end-of-life timelines.")

    with st.spinner("Analyzing product lifecycles..."):
        ai.ensure_product_lifecycle()

    summary = ai.get_product_velocity_summary()
    if summary.get("status") != "ok":
        st.warning("No product lifecycle data available. Ensure transaction data is loaded.")
        return

    # ------------------------------------------------------------------
    # Summary metrics
    # ------------------------------------------------------------------
    section_header("Lifecycle Overview")
    m1, m2, m3, m4, m5, m6 = st.columns(6)
    with m1:
        st.metric("Total Products", summary["total_products"])
    with m2:
        st.metric("Growing 🚀", summary["growing"])
    with m3:
        st.metric("Mature 📊", summary["mature"])
    with m4:
        st.metric("Plateauing ⏸", summary["plateauing"])
    with m5:
        st.metric("Declining 📉", summary["declining"])
    with m6:
        st.metric("End-of-Life ⚠", summary["end_of_life"])

    # ------------------------------------------------------------------
    # Lifecycle stage distribution
    # ------------------------------------------------------------------
    st.markdown("---")
    ch1, ch2 = st.columns([1, 2])

    velocity_df = ai.get_velocity_data()
    if not velocity_df.empty:
        with ch1:
            stage_counts = velocity_df["lifecycle_stage"].value_counts().reset_index()
            stage_counts.columns = ["Stage", "Count"]
            color_map = {
                "Growing": "#27ae60",
                "Mature": "#2980b9",
                "Plateauing": "#f39c12",
                "Declining": "#e74c3c",
                "End-of-Life": "#7f8c8d",
            }
            fig_pie = px.pie(
                stage_counts, names="Stage", values="Count",
                title="Lifecycle Stage Distribution",
                color="Stage", color_discrete_map=color_map,
                hole=0.35,
            )
            fig_pie.update_layout(height=350)
            st.plotly_chart(fig_pie, use_container_width=True)

        with ch2:
            fig_vel = px.bar(
                velocity_df.head(25),
                x="product_name", y="velocity_score",
                color="lifecycle_stage",
                color_discrete_map=color_map,
                title="Growth Velocity Score by Product (Top 25)",
                labels={"velocity_score": "Velocity Score", "product_name": "Product"},
            )
            fig_vel.update_layout(xaxis_tickangle=-45, height=350)
            st.plotly_chart(fig_vel, use_container_width=True)

    # ------------------------------------------------------------------
    # Growth Velocity Table
    # ------------------------------------------------------------------
    section_header("Growth Velocity Scorecard")
    f1, f2 = st.columns([1, 3])
    with f1:
        stages = ["All"] + sorted(velocity_df["lifecycle_stage"].unique().tolist()) if not velocity_df.empty else ["All"]
        stage_filter = st.selectbox("Filter by Stage", stages, key="vel_stage")
    with f2:
        prod_search = st.text_input("Search Product", "", key="vel_search")

    filtered = ai.get_velocity_data(stage_filter=stage_filter if stage_filter != "All" else None)
    if prod_search and not filtered.empty:
        filtered = filtered[filtered["product_name"].str.contains(prod_search, case=False, na=False)]

    if filtered.empty:
        st.info("No products match the selected filters.")
    else:
        display_cols = [c for c in [
            "product_name", "lifecycle_stage", "velocity_score", "growth_3m_pct",
            "slope_pct", "avg_monthly_revenue", "current_revenue", "peak_distance_pct",
            "months_since_peak", "buyer_trend", "revenue_cv",
        ] if c in filtered.columns]
        st.dataframe(
            filtered[display_cols],
            column_config={
                "product_name": "Product",
                "lifecycle_stage": "Stage",
                "velocity_score": st.column_config.NumberColumn("Velocity", format="%.3f"),
                "growth_3m_pct": st.column_config.NumberColumn("3M Growth %", format="%+.1f%%"),
                "slope_pct": st.column_config.NumberColumn("Trend Slope %", format="%+.1f%%"),
                "avg_monthly_revenue": st.column_config.NumberColumn("Avg Monthly Rev", format="Rs %.0f"),
                "current_revenue": st.column_config.NumberColumn("Current Rev", format="Rs %.0f"),
                "peak_distance_pct": st.column_config.NumberColumn("From Peak %", format="%.1f%%"),
                "months_since_peak": "Months Since Peak",
                "buyer_trend": st.column_config.NumberColumn("Buyer Trend", format="%+.2f"),
                "revenue_cv": st.column_config.NumberColumn("Volatility (CV)", format="%.2f"),
            },
            use_container_width=True,
            hide_index=True,
        )

    # ------------------------------------------------------------------
    # Individual Product Trend Drilldown
    # ------------------------------------------------------------------
    section_header("Product Trend Drilldown")
    if not velocity_df.empty:
        product_options = sorted(velocity_df["product_name"].unique().tolist())
        selected_product = st.selectbox("Select Product", product_options, key="trend_product")

        trend_data = ai.get_product_trend(selected_product)
        if not trend_data.empty:
            prod_info = velocity_df[velocity_df["product_name"] == selected_product]
            if not prod_info.empty:
                p = prod_info.iloc[0]
                i1, i2, i3, i4 = st.columns(4)
                with i1:
                    st.metric("Lifecycle Stage", p["lifecycle_stage"])
                with i2:
                    st.metric("Velocity Score", f"{p['velocity_score']:.3f}")
                with i3:
                    st.metric("3M Growth", f"{p['growth_3m_pct']:+.1f}%")
                with i4:
                    st.metric("From Peak", f"{p['peak_distance_pct']:.1f}%")

            tr1, tr2 = st.columns(2)
            with tr1:
                fig_rev = px.line(
                    trend_data, x="sale_month", y="monthly_revenue",
                    title=f"Monthly Revenue — {selected_product}",
                    labels={"monthly_revenue": "Revenue (Rs)", "sale_month": "Month"},
                    markers=True,
                )
                fig_rev.update_layout(height=350)
                st.plotly_chart(fig_rev, use_container_width=True)

            with tr2:
                fig_buyers = px.bar(
                    trend_data, x="sale_month", y="monthly_buyer_count",
                    title=f"Monthly Buyer Count — {selected_product}",
                    labels={"monthly_buyer_count": "Buyers", "sale_month": "Month"},
                    color_discrete_sequence=["#3498db"],
                )
                fig_buyers.update_layout(height=350)
                st.plotly_chart(fig_buyers, use_container_width=True)
        else:
            st.info("No monthly trend data available for this product.")

    # ------------------------------------------------------------------
    # Cannibalization Detection
    # ------------------------------------------------------------------
    section_header("Cannibalization Detection")
    st.caption("Products where a growing product may be replacing a declining one (based on MBA association rules).")

    cannibal_df = ai.get_cannibalization_data()
    if cannibal_df.empty:
        st.success("No cannibalization patterns detected.")
    else:
        st.warning(f"Detected **{len(cannibal_df)}** potential cannibalization pairs.")
        display_cols = [c for c in [
            "cannibal_product", "cannibal_growth_3m_pct", "victim_product",
            "victim_growth_3m_pct", "association_confidence", "association_lift",
            "cannibalization_score", "estimated_revenue_shift",
        ] if c in cannibal_df.columns]
        st.dataframe(
            cannibal_df[display_cols],
            column_config={
                "cannibal_product": "Replacing Product ↑",
                "cannibal_growth_3m_pct": st.column_config.NumberColumn("Its Growth %", format="%+.1f%%"),
                "victim_product": "Being Replaced ↓",
                "victim_growth_3m_pct": st.column_config.NumberColumn("Its Decline %", format="%+.1f%%"),
                "association_confidence": st.column_config.NumberColumn("Confidence", format="%.2f"),
                "association_lift": st.column_config.NumberColumn("Lift", format="%.2f"),
                "cannibalization_score": st.column_config.NumberColumn("Score", format="%.3f"),
                "estimated_revenue_shift": st.column_config.NumberColumn("Est. Rev Shift/3M", format="Rs %.0f"),
            },
            use_container_width=True,
            hide_index=True,
        )

        if len(cannibal_df) >= 2:
            fig_sankey = go.Figure(go.Sankey(
                arrangement="snap",
                node=dict(
                    label=list(set(cannibal_df["cannibal_product"].tolist() + cannibal_df["victim_product"].tolist())),
                    color=["#27ae60" if p in cannibal_df["cannibal_product"].values else "#e74c3c"
                           for p in set(cannibal_df["cannibal_product"].tolist() + cannibal_df["victim_product"].tolist())],
                ),
                link=dict(
                    source=[list(set(cannibal_df["cannibal_product"].tolist() + cannibal_df["victim_product"].tolist())).index(r["cannibal_product"]) for _, r in cannibal_df.iterrows()],
                    target=[list(set(cannibal_df["cannibal_product"].tolist() + cannibal_df["victim_product"].tolist())).index(r["victim_product"]) for _, r in cannibal_df.iterrows()],
                    value=cannibal_df["estimated_revenue_shift"].tolist(),
                ),
            ))
            fig_sankey.update_layout(title="Cannibalization Flow (Green = Growing, Red = Declining)", height=400)
            st.plotly_chart(fig_sankey, use_container_width=True)

    # ------------------------------------------------------------------
    # End-of-Life Predictions
    # ------------------------------------------------------------------
    section_header("End-of-Life Predictions")
    st.caption("Products at risk of becoming obsolete, with estimated timelines and recommended actions.")

    eol_filter = st.selectbox("Urgency Filter", ["All", "Critical", "High", "Medium", "Low"], key="eol_urgency")
    eol_df = ai.get_eol_predictions(urgency_filter=eol_filter if eol_filter != "All" else None)

    if eol_df.empty:
        st.success("No products flagged for end-of-life risk under the selected filter.")
    else:
        urgency_colors = {"Critical": "🔴", "High": "🟠", "Medium": "🟡", "Low": "🟢"}
        eol_display = eol_df.copy()
        eol_display["urgency_icon"] = eol_display["urgency"].map(urgency_colors).fillna("") + " " + eol_display["urgency"]

        display_cols = [c for c in [
            "product_name", "urgency_icon", "lifecycle_stage", "eol_risk_score",
            "est_months_to_zero", "current_revenue", "growth_3m_pct",
            "peak_distance_pct", "buyer_trend", "total_stock", "max_age_days",
            "suggested_action",
        ] if c in eol_display.columns]
        st.dataframe(
            eol_display[display_cols],
            column_config={
                "product_name": "Product",
                "urgency_icon": "Urgency",
                "lifecycle_stage": "Stage",
                "eol_risk_score": st.column_config.NumberColumn("Risk Score", format="%.3f"),
                "est_months_to_zero": st.column_config.NumberColumn("Est. Months to Zero", format="%.1f"),
                "current_revenue": st.column_config.NumberColumn("Current Rev", format="Rs %.0f"),
                "growth_3m_pct": st.column_config.NumberColumn("3M Growth %", format="%+.1f%%"),
                "peak_distance_pct": st.column_config.NumberColumn("From Peak %", format="%.1f%%"),
                "buyer_trend": st.column_config.NumberColumn("Buyer Trend", format="%+.2f"),
                "total_stock": st.column_config.NumberColumn("Stock Qty", format="%.0f"),
                "max_age_days": st.column_config.NumberColumn("Max Age (Days)", format="%.0f"),
                "suggested_action": "Suggested Action",
            },
            use_container_width=True,
            hide_index=True,
        )

        # EOL Risk Distribution
        if len(eol_df) > 3:
            fig_eol = px.scatter(
                eol_df, x="est_months_to_zero", y="eol_risk_score",
                size="current_revenue", color="urgency",
                color_discrete_map={
                    "Critical": "#e74c3c", "High": "#e67e22",
                    "Medium": "#f1c40f", "Low": "#27ae60",
                },
                hover_name="product_name",
                title="EOL Risk vs. Estimated Time to Zero Revenue",
                labels={
                    "est_months_to_zero": "Estimated Months to Zero Revenue",
                    "eol_risk_score": "EOL Risk Score",
                },
            )
            fig_eol.update_layout(height=400)
            st.plotly_chart(fig_eol, use_container_width=True)
