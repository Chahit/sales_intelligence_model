import streamlit as st
import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from styles import apply_global_styles, section_header, banner, page_caption


def render(ai):
    apply_global_styles()
    st.title("Inventory Liquidation")
    page_caption("Identify dead stock items and find the best partners to clear them.")
    ai.ensure_core_loaded()

    df_dead = ai.get_dead_stock()

    valid_items = ai.df_stock_stats["product_name"].unique()
    if len(valid_items) == 0:
        banner("✅ No critical dead stock found — nothing older than 60 days with more than 10 units.", "green")
        return
    else:
        banner(f"⚠️ {len(valid_items)} dead stock item(s) require attention.", "amber")
        items = sorted(valid_items)

    selected_item = st.selectbox("Select Dead Stock Item to Clear", items)
    stock_details = ai.get_stock_details(selected_item)

    if stock_details is not None:
        c1, c2, c3 = st.columns(3)
        with c1:
            st.metric("Total Stock Left", f"{stock_details['total_stock_qty']} Units")
        with c2:
            st.metric(
                "Max Age",
                f"{stock_details['max_age_days']} Days",
                delta=f"P{stock_details.get('age_percentile', 0):.1f} in portfolio",
                delta_color="off",
            )
            if stock_details.get("demand_recency_days") is not None:
                st.caption(
                    f"Effective age: {stock_details.get('effective_age_days', stock_details['max_age_days'])} days "
                    f"(last buyer activity {stock_details['demand_recency_days']} days ago)"
                )
        with c3:
            st.metric(
                "Priority",
                stock_details.get("priority", "High"),
                delta=stock_details.get("priority_delta", "Plan Sales"),
                delta_color="inverse",
            )
            st.caption(f"Exposure score: {stock_details.get('stock_exposure_score', 0):.1f}/100")
    elif selected_item:
        st.warning("Stock details not found in ageing view. Showing potential buyers only.")

    st.markdown("---")

    if selected_item:
        leads = df_dead[df_dead["dead_stock_item"] == selected_item].sort_values(
            "buyer_past_purchase_qty", ascending=False
        )
        section_header(f"Target Buyers — {selected_item} ({len(leads)} found)")
        st.dataframe(
            leads[
                ["potential_buyer", "mobile_no", "buyer_past_purchase_qty", "last_purchase_date"]
            ],
            column_config={
                "potential_buyer": "Partner Name",
                "mobile_no": "Contact Number",
                "buyer_past_purchase_qty": st.column_config.NumberColumn("Past Qty Bought"),
                "last_purchase_date": "Last Purchase",
            },
            use_container_width=True,
            hide_index=True,
        )
