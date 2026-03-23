"""Partner 360 router — exposes partner list, states, and full intelligence report."""
import math
from fastapi import APIRouter, Depends, HTTPException, Query
from backend.dependencies import get_engine
from ml_engine.sales_model import SalesIntelligenceEngine

router = APIRouter()


def _safe(val):
    """Convert NaN/Inf floats to None so JSON serialisation works."""
    try:
        if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
            return None
        return val
    except Exception:
        return val


@router.get("/states")
def get_states(ai: SalesIntelligenceEngine = Depends(get_engine)):
    """Return all states/regions that have active partners."""
    ai.ensure_clustering()
    if ai.matrix is None or ai.matrix.empty:
        return {"states": []}
    states = sorted(ai.matrix["state"].dropna().unique().tolist())
    return {"states": states}


@router.get("/list")
def get_partners(
    state: str = Query(..., description="State/region filter"),
    ai: SalesIntelligenceEngine = Depends(get_engine),
):
    """Return all partner names in a given state."""
    ai.ensure_clustering()
    if ai.matrix is None or ai.matrix.empty:
        return {"partners": []}
    filtered = ai.matrix[ai.matrix["state"] == state]
    partners = sorted(filtered.index.unique().tolist())
    return {"partners": partners}


@router.get("/{partner_name}")
def get_partner_intelligence(
    partner_name: str,
    ai: SalesIntelligenceEngine = Depends(get_engine),
):
    """Return the full 360-degree intelligence report for a partner."""
    ai.ensure_clustering()
    report = ai.get_partner_intelligence(partner_name)
    if not report:
        raise HTTPException(status_code=404, detail=f"No report for '{partner_name}'")

    # Sanitise DataFrames → JSON-safe dicts
    gaps = report.get("gaps")
    if gaps is not None and hasattr(gaps, "to_dict"):
        report["gaps"] = gaps.where(gaps.notna(), None).to_dict(orient="records")

    monthly = report.get("monthly_revenue_history")
    if monthly is not None and hasattr(monthly, "to_dict"):
        report["monthly_revenue_history"] = monthly.where(monthly.notna(), None).to_dict(orient="records")

    # Sanitise facts dict
    facts = report.get("facts", {})
    if isinstance(facts, dict):
        report["facts"] = {k: _safe(v) for k, v in facts.items()}

    # Sanitise alerts list
    alerts = report.get("alerts", [])
    if isinstance(alerts, list):
        report["alerts"] = [
            {k: _safe(v) for k, v in a.items()} if isinstance(a, dict) else a
            for a in alerts
        ]

    return report
