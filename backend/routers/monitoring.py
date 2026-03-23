"""Monitoring router — system health, alerts, cluster quality."""
from fastapi import APIRouter, Depends, Query
from backend.dependencies import get_engine
from ml_engine.sales_model import SalesIntelligenceEngine

router = APIRouter()


def _clean_df(df):
    if df is None or df.empty:
        return []
    return df.where(df.notna(), None).to_dict(orient="records")


@router.get("/snapshot")
def get_snapshot(ai: SalesIntelligenceEngine = Depends(get_engine)):
    """Return the monitoring snapshot (partner count, cluster stats, etc.)."""
    ai.ensure_clustering()
    return ai.get_monitoring_snapshot()


@router.get("/alerts")
def get_alerts(
    limit: int = Query(100, ge=1, le=500),
    ai: SalesIntelligenceEngine = Depends(get_engine),
):
    """Return operational alerts snapshot."""
    ai.ensure_clustering()
    return ai.get_alert_snapshot(limit=limit)


@router.get("/data-quality")
def get_data_quality(ai: SalesIntelligenceEngine = Depends(get_engine)):
    """Return data quality report."""
    ai.ensure_core_loaded()
    return ai.get_data_quality_report()


@router.get("/cluster-quality")
def get_cluster_quality(ai: SalesIntelligenceEngine = Depends(get_engine)):
    """Return cluster quality report."""
    ai.ensure_clustering()
    if hasattr(ai, "get_cluster_quality_report"):
        return ai.get_cluster_quality_report() or {"status": "unavailable"}
    return {"status": "unavailable"}


@router.get("/realtime-status")
def get_realtime_status(ai: SalesIntelligenceEngine = Depends(get_engine)):
    """Return the realtime job queue status."""
    return ai.get_realtime_status()
