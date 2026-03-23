"""Sales Rep router — leaderboard and individual rep drilldown."""
from fastapi import APIRouter, Depends, Query
from backend.dependencies import get_engine
from ml_engine.sales_model import SalesIntelligenceEngine

router = APIRouter()


def _clean_df(df):
    if df is None or df.empty:
        return []
    return df.where(df.notna(), None).to_dict(orient="records")


@router.get("/leaderboard")
def get_leaderboard(ai: SalesIntelligenceEngine = Depends(get_engine)):
    """Return the full sales rep leaderboard."""
    df = ai.get_sales_rep_leaderboard()
    return {"status": "ok", "rows": _clean_df(df)}


@router.get("/monthly-revenue")
def get_monthly_revenue(
    rep_id: int = Query(..., description="User ID of the sales rep"),
    ai: SalesIntelligenceEngine = Depends(get_engine),
):
    """Return monthly actual vs forecast revenue for a specific rep."""
    df = ai.get_rep_monthly_revenue(rep_id) if hasattr(ai, "get_rep_monthly_revenue") else None
    if df is None or (hasattr(df, "empty") and df.empty):
        return {"status": "no_data", "rows": []}
    rows = _clean_df(df)
    for row in rows:
        for k, v in row.items():
            if hasattr(v, "isoformat"):
                row[k] = str(v)[:10]
    return {"status": "ok", "rows": rows}
