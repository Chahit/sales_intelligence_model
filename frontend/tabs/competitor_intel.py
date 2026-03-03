import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from styles import apply_global_styles, section_header, banner, page_caption


def render(ai):
    apply_global_styles()
    st.title("Competitor Price Intelligence")
    page_caption("Monitor competitor pricing, detect undercuts, and optimize your market positioning.")

    # Check if competitor tables exist
    if not hasattr(ai, "competitor_repo") or ai.competitor_repo is None:
        st.error("Competitor intelligence module is not available. Ensure the competitor_repository is configured.")
        return

    tables_exist = ai.competitor_repo._table_exists("competitor_products")
    if not tables_exist:
        st.warning(
            "Competitor tables not found in the database. "
            "Run `db/competitor_intelligence_schema.sql` to set up the schema, "
            "then upload competitor pricing data below."
        )

    # --- Data Upload Section ---
    with st.expander("📤 Import Pricing Data", expanded=not tables_exist):
        st.caption("Upload CSV files to populate competitor and our product pricing data.")
        up1, up2 = st.columns(2)

        with up1:
            st.markdown("**Upload Our Product Pricing**")
            st.caption("Columns: `product_name`, `unit_price`, `product_group` (optional), `cost_price` (optional), `margin_pct` (optional)")
            our_file = st.file_uploader("Our Pricing CSV", type=["csv", "xlsx"], key="our_pricing_upload")
            if our_file:
                try:
                    if our_file.name.endswith(".xlsx"):
                        our_df = pd.read_excel(our_file)
                    else:
                        our_df = pd.read_csv(our_file)
                    st.dataframe(our_df.head(5), use_container_width=True, hide_index=True)
                    if st.button("Import Our Pricing", key="import_our"):
                        n = ai.import_our_pricing_data(our_df)
                        st.success(f"Imported {n} product prices.")
                        ai._competitor_loaded = False
                except Exception as e:
                    st.error(f"Failed to read file: {e}")

        with up2:
            st.markdown("**Upload Competitor Pricing**")
            st.caption("Columns: `competitor_name`, `product_name`, `unit_price`, `product_group` (optional), `source` (optional)")
            comp_file = st.file_uploader("Competitor Pricing CSV", type=["csv", "xlsx"], key="comp_pricing_upload")
            if comp_file:
                try:
                    if comp_file.name.endswith(".xlsx"):
                        comp_df = pd.read_excel(comp_file)
                    else:
                        comp_df = pd.read_csv(comp_file)
                    st.dataframe(comp_df.head(5), use_container_width=True, hide_index=True)
                    if st.button("Import Competitor Pricing", key="import_comp"):
                        n = ai.import_competitor_data(comp_df)
                        st.success(f"Imported {n} competitor prices.")
                        ai._competitor_loaded = False
                except Exception as e:
                    st.error(f"Failed to read file: {e}")

    if not tables_exist:
        return

    # --- Load data ---
    with st.spinner("Loading competitor intelligence..."):
        ai.ensure_competitor_data()

    summary = ai.get_competitor_summary()
    if summary.get("our_product_count", 0) == 0 and summary.get("competitor_product_entries", 0) == 0:
        st.info("No pricing data found. Upload your product pricing and competitor data above to get started.")
        return

    # --- Summary Metrics ---
    st.markdown("---")
    st.subheader("Market Overview")
    m1, m2, m3, m4, m5, m6 = st.columns(6)
    with m1:
        st.metric("Our Products", int(summary.get("our_product_count", 0)))
    with m2:
        st.metric("Competitors", int(summary.get("competitor_count", 0)))
    with m3:
        st.metric("Matched Products", int(summary.get("matched_products", 0)))
    with m4:
        avg_diff = float(summary.get("avg_price_diff_pct", 0))
        st.metric(
            "Avg Price Diff",
            f"{avg_diff:+.1f}%",
            delta="Cheaper" if avg_diff < 0 else "Premium" if avg_diff > 0 else "Parity",
            delta_color="inverse" if avg_diff < 0 else "normal",
        )
    with m5:
        st.metric("We're Undercut", int(summary.get("products_undercut", 0)))
    with m6:
        st.metric("We're Cheaper", int(summary.get("products_premium", 0)))

    # --- Full Comparison Table ---
    section_header("Price Comparison")
    f1, f2 = st.columns([1, 2])
    with f1:
        comparison = ai.get_price_comparison()
        groups = ["All"]
        if not comparison.empty and "product_group" in comparison.columns:
            groups += sorted(comparison["product_group"].dropna().unique().tolist())
        selected_group = st.selectbox("Product Group", groups, key="comp_group")
    with f2:
        search = st.text_input("Search Product", "", key="comp_search")

    comparison = ai.get_price_comparison(
        product_group=selected_group if selected_group != "All" else None,
        search_term=search,
    )

    if comparison.empty:
        st.info("No price comparison data available for the selected filters.")
    else:
        display_cols = [c for c in [
            "product_name", "product_group", "our_price", "competitor_name",
            "competitor_price", "price_diff_pct", "our_margin_pct", "competitor_source",
        ] if c in comparison.columns]

        # Color-coded price diff
        def _style_price_diff(val):
            try:
                v = float(val)
                if v <= -5:
                    return "color: #34d96f; font-weight:600"  # green: we're cheaper
                if v >= 5:
                    return "color: #f55c5c; font-weight:600"  # red: undercut
                return ""
            except Exception:
                return ""

        styled = comparison[display_cols].style.applymap(
            _style_price_diff,
            subset=["price_diff_pct"] if "price_diff_pct" in display_cols else [],
        )
        st.dataframe(
            styled,
            column_config={
                "product_name": "Product",
                "product_group": "Group",
                "our_price": st.column_config.NumberColumn("Our Price", format="Rs %.2f"),
                "competitor_name": "Competitor",
                "competitor_price": st.column_config.NumberColumn("Competitor Price", format="Rs %.2f"),
                "price_diff_pct": st.column_config.NumberColumn("Price Diff %", format="%+.1f%%"),
                "our_margin_pct": st.column_config.NumberColumn("Our Margin %", format="%.1f%%"),
                "competitor_source": "Source",
            },
            use_container_width=True,
            hide_index=True,
        )

    # --- Price Positioning Chart ---
    section_header("Price Positioning Map")
    position_matrix = ai.get_competitor_positioning_matrix()
    if position_matrix is not None and not position_matrix.empty and len(position_matrix.columns) > 1:
        # Melt for grouped bar chart
        price_cols = [c for c in position_matrix.columns if c != "product_name"]
        melted = position_matrix.head(30).melt(
            id_vars=["product_name"],
            value_vars=price_cols,
            var_name="Source",
            value_name="Price",
        ).dropna(subset=["Price"])

        if not melted.empty:
            fig = px.bar(
                melted,
                x="product_name",
                y="Price",
                color="Source",
                barmode="group",
                title="Price Comparison by Product (Top 30)",
                color_discrete_sequence=px.colors.qualitative.Set2,
            )
            fig.update_layout(xaxis_tickangle=-45, height=500)
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("Not enough data for positioning chart.")
    else:
        st.info("Positioning matrix requires both our pricing and competitor pricing data.")

    # --- Undercut Analysis ---
    section_header("Undercut Analysis")
    st.caption("Products where competitors are significantly cheaper than us.")
    undercut_threshold = st.slider("Undercut Threshold (%)", -50, 0, -5, 1, key="undercut_thresh")
    undercuts = ai.get_undercut_products(min_diff_pct=float(undercut_threshold))

    if undercuts.empty:
        st.success(f"No products found where competitors are more than {abs(undercut_threshold)}% cheaper.")
    else:
        st.warning(f"Found **{len(undercuts)}** product-competitor pairs where we are undercut.")
        display_cols = [c for c in [
            "product_name", "product_group", "our_price", "competitor_name",
            "competitor_price", "price_diff_pct",
        ] if c in undercuts.columns]
        st.dataframe(
            undercuts[display_cols],
            column_config={
                "product_name": "Product",
                "product_group": "Group",
                "our_price": st.column_config.NumberColumn("Our Price", format="Rs %.2f"),
                "competitor_name": "Competitor",
                "competitor_price": st.column_config.NumberColumn("Their Price", format="Rs %.2f"),
                "price_diff_pct": st.column_config.NumberColumn("Diff %", format="%+.1f%%"),
            },
            use_container_width=True,
            hide_index=True,
        )

        # Undercut distribution chart
        if "price_diff_pct" in undercuts.columns and len(undercuts) > 1:
            fig2 = px.histogram(
                undercuts,
                x="price_diff_pct",
                nbins=20,
                title="Distribution of Competitor Undercuts",
                labels={"price_diff_pct": "Price Difference (%)"},
                color_discrete_sequence=["#e74c3c"],
            )
            st.plotly_chart(fig2, use_container_width=True)

    # --- Premium Products (Our Advantage) ---
    section_header("Our Price Advantage")
    st.caption("Products where we are cheaper than competitors — leverage these in pitches.")
    premiums = ai.get_premium_products(min_diff_pct=5.0)

    if premiums.empty:
        st.info("No significant price advantages detected (threshold: 5%+).")
    else:
        st.success(f"**{len(premiums)}** product-competitor pairs where we have a price advantage.")
        display_cols = [c for c in [
            "product_name", "product_group", "our_price", "competitor_name",
            "competitor_price", "price_diff_pct",
        ] if c in premiums.columns]
        st.dataframe(
            premiums[display_cols],
            column_config={
                "product_name": "Product",
                "product_group": "Group",
                "our_price": st.column_config.NumberColumn("Our Price", format="Rs %.2f"),
                "competitor_name": "Competitor",
                "competitor_price": st.column_config.NumberColumn("Their Price", format="Rs %.2f"),
                "price_diff_pct": st.column_config.NumberColumn("Diff %", format="%+.1f%%"),
            },
            use_container_width=True,
            hide_index=True,
        )

    # --- Price Alerts ---
    section_header("Price Alerts")
    a1, a2 = st.columns([1, 1])
    with a1:
        if st.button("🔄 Generate New Alerts", key="gen_alerts"):
            new_alerts = ai.generate_price_alerts(
                undercut_threshold_pct=-10.0,
                severe_threshold_pct=-20.0,
            )
            if new_alerts:
                st.success(f"Generated {len(new_alerts)} new price alerts.")
            else:
                st.info("No new alerts to generate.")
    with a2:
        show_resolved = st.checkbox("Show Resolved Alerts", value=False, key="show_resolved")

    alerts_df = ai.get_price_alerts(unresolved_only=not show_resolved)
    if alerts_df.empty:
        st.success("No active price alerts.")
    else:
        display_cols = [c for c in [
            "id", "product_name", "competitor_name", "our_price",
            "competitor_price", "price_diff_pct", "severity", "is_resolved", "created_at",
        ] if c in alerts_df.columns]
        st.dataframe(
            alerts_df[display_cols],
            column_config={
                "id": "Alert ID",
                "product_name": "Product",
                "competitor_name": "Competitor",
                "our_price": st.column_config.NumberColumn("Our Price", format="Rs %.2f"),
                "competitor_price": st.column_config.NumberColumn("Their Price", format="Rs %.2f"),
                "price_diff_pct": st.column_config.NumberColumn("Diff %", format="%+.1f%%"),
                "severity": "Severity",
                "is_resolved": "Resolved",
                "created_at": "Created",
            },
            use_container_width=True,
            hide_index=True,
        )
