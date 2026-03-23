import streamlit as st
import pandas as pd
import plotly.express as px
import sys, os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from styles import apply_global_styles, section_header, banner, page_caption, page_header, skeleton_loader

def render(ai):
    apply_global_styles()
    page_header(
        title="Inventory Liquidation",
        subtitle="Identify dead stock items and proactively find the best partners to clear them.",
        icon="📦",
        accent_color="#f59e0b",
    )
    skel = st.empty()
    with skel.container():
        skeleton_loader(n_metric_cards=3, n_rows=2, label="Scanning inventory ageing...")
    ai.ensure_core_loaded()
    ai.ensure_clustering()
    skel.empty()

    df_dead = ai.get_dead_stock()
    stats_df = getattr(ai, "df_stock_stats", None)

    if stats_df is None or stats_df.empty:
        banner("✅ No inventory data available to analyze.", "green")
        return

    # ── Ageing Distribution ──
    st.subheader("📊 Portfolio Ageing Distribution")
    age_cols = ["age_0_30", "age_31_60", "age_61_90", "age_90_plus"]
    if all(c in stats_df.columns for c in age_cols):
        age_sums = stats_df[age_cols].sum()
        age_df = pd.DataFrame({
            "Bucket": ["0-30 Days", "31-60 Days", "61-90 Days", "90+ Days"],
            "Stock Value (Rs)": [age_sums["age_0_30"], age_sums["age_31_60"], age_sums["age_61_90"], age_sums["age_90_plus"]]
        })
        fig = px.bar(
            age_df, x="Bucket", y="Stock Value (Rs)",
            color="Bucket",
            color_discrete_map={"0-30 Days":"#10b981", "31-60 Days":"#f59e0b", "61-90 Days":"#f97316", "90+ Days":"#ef4444"},
            title="Total Capital Locked by Age Bucket"
        )
        fig.update_layout(paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)", showlegend=False, height=300)
        st.plotly_chart(fig, use_container_width=True)

    st.markdown("---")

    valid_items = stats_df["product_name"].unique()
    if len(valid_items) == 0:
        banner("✅ No critical dead stock found — nothing older than 60 days with more than 10 units.", "green")
        return
    else:
        items = sorted(valid_items)

    selected_item = st.selectbox("📦 Select Dead Stock Item to clear", items)


    stock_details = ai.get_stock_details(selected_item)

    if stock_details is not None:
        c1, c2, c3, c4 = st.columns(4)
        total_qty = stock_details.get('total_stock_qty', 0)
        cost_price = stock_details.get('cost_price', 1000) # Fallback if missing
        capital_locked = total_qty * cost_price

        c1.metric("Units to Clear", f"{total_qty} Units")
        c2.metric("Capital Locked", f"Rs {capital_locked:,.0f}")
        c3.metric("Max Age in WH", f"{stock_details.get('max_age_days', 0)} Days")
        c4.metric(
            "Priority",
            stock_details.get("priority", "High"),
            delta=stock_details.get("priority_delta", "Plan Sales"),
            delta_color="inverse",
        )
    elif selected_item:
        st.warning("Stock details not found in ageing view. Showing potential buyers only.")

    st.markdown("---")

    if selected_item:
        # Leads logic relies on the df_dead structure which maps item -> potential buyer
        leads = df_dead[df_dead["dead_stock_item"] == selected_item].copy()
        
        # Merge Clustering state to find lookalike audiences
        if not leads.empty and getattr(ai, "df_partner_features", None) is not None:
            pf = ai.df_partner_features.reset_index()
            # If company_name isn't there, it might be the index
            if "company_name" not in pf.columns and "index" in pf.columns:
                pf = pf.rename(columns={"index": "company_name"})
            
            leads = leads.merge(
                pf[["company_name", "cluster_label"]] if "cluster_label" in pf.columns else pf[["company_name"]],
                left_on="potential_buyer", right_on="company_name", how="left"
            )
            leads["Audience Type"] = "Past Buyer"
            
            # Find lookalikes (same cluster, but haven't bought this yet)
            if "cluster_label" in leads.columns and "cluster_label" in pf.columns:
                buyer_clusters = leads["cluster_label"].dropna().unique()
                if len(buyer_clusters) > 0:
                    lookalikes = pf[pf["cluster_label"].isin(buyer_clusters) & ~pf["company_name"].isin(leads["potential_buyer"])].copy()
                    if not lookalikes.empty:
                        if "recent_90_revenue" in lookalikes.columns:
                            lookalikes = lookalikes.sort_values("recent_90_revenue", ascending=False).head(10)
                        else:
                            lookalikes = lookalikes.head(10)
                            
                        lookalike_df = pd.DataFrame({
                            "potential_buyer": lookalikes["company_name"],
                            "mobile_no": "Lookalike",
                            "buyer_past_purchase_qty": 0,
                            "last_purchase_date": "Never",
                            "Audience Type": f"Lookalike (Cluster: {lookalikes.iloc[0]['cluster_label']})"
                        })
                        leads = pd.concat([leads, lookalike_df], ignore_index=True)

        leads = leads.sort_values("buyer_past_purchase_qty", ascending=False)
        
        col_hdr, col_dl = st.columns([3, 1])
        with col_hdr:
            section_header(f"Target Buyers — {selected_item} ({len(leads)} leads)")
        with col_dl:
            csv = leads[["potential_buyer", "mobile_no", "buyer_past_purchase_qty", "Audience Type"]].to_csv(index=False)
            st.download_button("⬇️ Export Campaign List", csv, f"leads_{selected_item.replace(' ', '_')}.csv", "text/csv", use_container_width=True)

        st.dataframe(
            leads[
                ["potential_buyer", "mobile_no", "Audience Type", "buyer_past_purchase_qty", "last_purchase_date"]
            ],
            column_config={
                "potential_buyer": "Partner Name",
                "mobile_no": "Contact Number",
                "Audience Type": "Audience Strategy",
                "buyer_past_purchase_qty": st.column_config.NumberColumn("Past Qty Bought", format="%d"),
                "last_purchase_date": "Last Purchase",
            },
            use_container_width=True,
            hide_index=True,
        )
