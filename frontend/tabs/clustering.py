import numpy as np
import pandas as pd
import plotly.express as px
import streamlit as st
from sklearn.decomposition import PCA

import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from ml_engine.services.export_service import (
    export_cluster_summary_pdf,
    export_cluster_summary_excel,
)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from styles import apply_global_styles, section_header, page_caption, banner


def render(ai):
    apply_global_styles()
    st.title("Cluster Intelligence")
    page_caption("AI-generated partner segments based on buying behaviour, RFM signals, and category mix.")
    with st.spinner("Computing clusters..."):
        ai.ensure_clustering()

    matrix = ai.matrix.copy()
    if matrix is None or matrix.empty:
        st.warning("Cluster matrix is empty. Refresh data and try again.")
        return

    if "cluster_label" not in matrix.columns:
        matrix["cluster_label"] = matrix["cluster"].astype(str)
    if "cluster_type" not in matrix.columns:
        matrix["cluster_type"] = "Growth"
    if "strategic_tag" not in matrix.columns:
        matrix["strategic_tag"] = "N/A"

    # Stats — detect outliers by either legacy "Outlier" label or renamed "Uncategorized"
    is_outlier = matrix["cluster_label"].astype(str).str.contains("Outlier|Uncategorized", case=False, na=False)
    n_clusters = matrix.loc[~is_outlier, "cluster_label"].nunique()
    n_outliers = is_outlier.sum()
    n_vip = (matrix["cluster_type"] == "VIP").sum()

    c1, c2, c3 = st.columns(3)
    with c1:
        st.metric("Total Clusters Formed", int(n_clusters))
    with c2:
        st.metric("Outlier Partners", int(n_outliers))
    with c3:
        st.metric("VIP Partners", int(n_vip))

    # --- Export Buttons ---
    cex1, cex2, cex3 = st.columns([1, 1, 4])
    with cex1:
        cluster_pdf = export_cluster_summary_pdf(
            matrix,
            quality_report=ai.get_cluster_quality_report() if hasattr(ai, "get_cluster_quality_report") else None,
            business_report=ai.get_cluster_business_validation_report() if hasattr(ai, "get_cluster_business_validation_report") else None,
        )
        st.download_button(
            "\u2B07 Download PDF",
            data=cluster_pdf,
            file_name="Cluster_Summary.pdf",
            mime="application/pdf",
            key="cluster_pdf",
        )
    with cex2:
        cluster_xls = export_cluster_summary_excel(
            matrix,
            quality_report=ai.get_cluster_quality_report() if hasattr(ai, "get_cluster_quality_report") else None,
            business_report=ai.get_cluster_business_validation_report() if hasattr(ai, "get_cluster_business_validation_report") else None,
        )
        st.download_button(
            "\u2B07 Download Excel",
            data=cluster_xls,
            file_name="Cluster_Summary.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            key="cluster_xlsx",
        )

    st.markdown("---")

    # ── Cluster Summary Table ────────────────────────────────────────────────
    section_header("Cluster Summary")
    cluster_summary = (
        matrix[~is_outlier]
        .groupby(["cluster_label", "cluster_type"])
        .agg(
            Partners=("cluster_label", "count"),
        )
        .reset_index()
        .sort_values("Partners", ascending=False)
    )
    # Add avg revenue column if available
    rev_col = next((c for c in ["total_revenue", "revenue", "Total Revenue"] if c in matrix.columns), None)
    if rev_col:
        rev_agg = matrix[~is_outlier].groupby("cluster_label")[rev_col].mean().rename("Avg Revenue (Rs)")
        cluster_summary = cluster_summary.merge(rev_agg, on="cluster_label", how="left")
        st.dataframe(
            cluster_summary,
            column_config={
                "cluster_label": st.column_config.TextColumn("Cluster"),
                "cluster_type": "Type",
                "Partners": st.column_config.NumberColumn("Partners", format="%d"),
                "Avg Revenue (Rs)": st.column_config.NumberColumn("Avg Revenue", format="Rs %.0f"),
            },
            use_container_width=True,
            hide_index=True,
        )
    else:
        st.dataframe(
            cluster_summary,
            column_config={
                "cluster_label": st.column_config.TextColumn("Cluster"),
                "cluster_type": "Type",
                "Partners": st.column_config.NumberColumn("Partners", format="%d"),
            },
            use_container_width=True,
            hide_index=True,
        )

    # ── 3D DNA Map ───────────────────────────────────────────────────────────
    section_header("Partner DNA Map (3D)")

    # Filters
    f1, f2 = st.columns([1, 2])
    with f1:
        type_options = ["All"] + sorted(matrix["cluster_type"].dropna().unique().tolist())
        selected_type = st.selectbox("Cluster Type", type_options)
    with f2:
        label_options = ["All"] + sorted(matrix["cluster_label"].dropna().unique().tolist())
        selected_label = st.selectbox("Cluster Label", label_options)

    filtered = matrix.copy()
    if selected_type != "All":
        filtered = filtered[filtered["cluster_type"] == selected_type]
    if selected_label != "All":
        filtered = filtered[filtered["cluster_label"] == selected_label]

    if filtered.empty:
        st.warning("No partners match the selected filters.")
        return

    # Build PCA input from numeric spend columns only.
    feature_df = filtered.select_dtypes(include=[np.number]).drop(
        columns=["cluster"], errors="ignore"
    )
    feature_df = feature_df.fillna(0)

    if feature_df.shape[1] == 0:
        st.warning("No numeric features available for PCA visualization.")
        return

    # PCA supports up to available dimensions. Keep 3D output shape stable.
    n_components = min(3, feature_df.shape[0], feature_df.shape[1])
    if n_components < 2:
        st.warning("Not enough data points to render cluster map.")
        return

    log_features = np.log1p(feature_df)
    pca = PCA(n_components=n_components, random_state=42)
    components = pca.fit_transform(log_features)

    plot_df = pd.DataFrame(index=filtered.index)
    plot_df["x"] = components[:, 0]
    plot_df["y"] = components[:, 1]
    plot_df["z"] = components[:, 2] if n_components >= 3 else 0.0
    plot_df["Partner"] = filtered.index
    plot_df["Cluster"] = filtered["cluster_label"].astype(str)
    plot_df["Cluster Type"] = filtered["cluster_type"].astype(str)
    plot_df["Strategic Tag"] = filtered["strategic_tag"].astype(str)
    plot_df["State"] = filtered["state"].astype(str) if "state" in filtered.columns else "Unknown"

    fig = px.scatter_3d(
        plot_df,
        x="x",
        y="y",
        z="z",
        color="Cluster",
        symbol="Cluster Type",
        hover_name="Partner",
        hover_data=["State", "Strategic Tag"],
        title="Partner DNA Map (Color = Cluster Label, Symbol = Cluster Type)",
        color_discrete_sequence=px.colors.qualitative.Bold,
    )
    st.plotly_chart(fig, use_container_width=True)
