"""Pipeline / Kanban router — partner health pipeline data."""
from fastapi import APIRouter, Depends
from backend.dependencies import get_engine
from ml_engine.sales_model import SalesIntelligenceEngine

router = APIRouter()

LANES = [
    {"key": "champion", "label": "Champion",  "segments": ["Champion"]},
    {"key": "healthy",  "label": "Healthy",   "segments": ["Healthy"]},
    {"key": "at_risk",  "label": "At Risk",   "segments": ["At Risk"]},
    {"key": "critical", "label": "Critical",  "segments": ["Critical"]},
]


@router.get("/kanban")
def get_kanban(ai: SalesIntelligenceEngine = Depends(get_engine)):
    """Return partners split by health segment for the Kanban board."""
    ai.ensure_clustering()
    if ai.df_partner_features is None or ai.df_partner_features.empty:
        return {"status": "no_data", "lanes": []}

    pf = ai.df_partner_features.copy().reset_index()
    if "company_name" not in pf.columns and "index" in pf.columns:
        pf = pf.rename(columns={"index": "company_name"})

    needed = [
        "company_name", "state", "health_segment", "health_status",
        "churn_probability", "credit_risk_band",
        "recent_90_revenue", "revenue_drop_pct",
    ]
    cols = [c for c in needed if c in pf.columns]
    pf = pf[cols].copy()

    # Fill defaults
    if "churn_probability" not in pf.columns:
        pf["churn_probability"] = 0.0
    if "credit_risk_band" not in pf.columns:
        pf["credit_risk_band"] = "N/A"
    if "health_segment" not in pf.columns:
        pf["health_segment"] = "Healthy"

    lanes_data = []
    for lane in LANES:
        subset = pf[pf["health_segment"].isin(lane["segments"])]
        lanes_data.append({
            "key": lane["key"],
            "label": lane["label"],
            "count": len(subset),
            "partners": subset.where(subset.notna(), None).to_dict(orient="records"),
        })

    return {"status": "ok", "lanes": lanes_data}
