"""Clustering router — cluster summary, partner DNA matrix, composition."""
import math
from fastapi import APIRouter, Depends
from backend.dependencies import get_engine
from ml_engine.sales_model import SalesIntelligenceEngine

router = APIRouter()


def _clean_df(df):
    if df is None or df.empty:
        return []
    return df.where(df.notna(), None).to_dict(orient="records")


@router.get("/summary")
def get_cluster_summary(ai: SalesIntelligenceEngine = Depends(get_engine)):
    """Return cluster summary counts and metadata."""
    ai.ensure_clustering()
    if ai.matrix is None or ai.matrix.empty:
        return {"status": "no_data", "clusters": []}

    matrix = ai.matrix.copy()
    if "cluster_label" not in matrix.columns:
        matrix["cluster_label"] = matrix["cluster"].astype(str)
    if "cluster_type" not in matrix.columns:
        matrix["cluster_type"] = "Growth"

    is_outlier = matrix["cluster_label"].astype(str).str.contains(
        "Outlier|Uncategorized", case=False, na=False
    )
    n_clusters = int(matrix.loc[~is_outlier, "cluster_label"].nunique())
    n_outliers = int(is_outlier.sum())
    n_vip = int((matrix["cluster_type"] == "VIP").sum())

    # Cluster breakdown
    rev_col = next(
        (c for c in ["total_revenue", "revenue", "recent_90_revenue"] if c in matrix.columns),
        None,
    )
    grp = matrix[~is_outlier].groupby(["cluster_label", "cluster_type"])
    agg = grp.size().reset_index(name="partners")
    if rev_col:
        rev_agg = matrix[~is_outlier].groupby("cluster_label")[rev_col].mean().rename("avg_revenue")
        agg = agg.merge(rev_agg, on="cluster_label", how="left")

    return {
        "status": "ok",
        "n_clusters": n_clusters,
        "n_outliers": n_outliers,
        "n_vip": n_vip,
        "clusters": _clean_df(agg),
    }


@router.get("/matrix")
def get_cluster_matrix(ai: SalesIntelligenceEngine = Depends(get_engine)):
    """Return the full partner cluster matrix (for 3D DNA map)."""
    ai.ensure_clustering()
    if ai.matrix is None or ai.matrix.empty:
        return {"status": "no_data", "rows": []}

    matrix = ai.matrix.copy().reset_index()
    if "cluster_label" not in matrix.columns:
        matrix["cluster_label"] = matrix.get("cluster", "Unknown").astype(str)
    if "cluster_type" not in matrix.columns:
        matrix["cluster_type"] = "Growth"
    if "strategic_tag" not in matrix.columns:
        matrix["strategic_tag"] = "N/A"

    keep = ["company_name", "state", "cluster_label", "cluster_type", "strategic_tag"]
    available = [c for c in keep if c in matrix.columns]
    return {
        "status": "ok",
        "rows": _clean_df(matrix[available]),
    }


@router.get("/quality-report")
def get_quality_report(ai: SalesIntelligenceEngine = Depends(get_engine)):
    """Return the cluster quality report."""
    ai.ensure_clustering()
    report = ai.get_cluster_quality_report() if hasattr(ai, "get_cluster_quality_report") else {}
    return report or {"status": "unavailable"}
