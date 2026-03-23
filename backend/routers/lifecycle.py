"""Product Lifecycle router — velocity, EOL predictions, cannibalization, trend."""
from fastapi import APIRouter, Depends, Query
from backend.dependencies import get_engine
from ml_engine.sales_model import SalesIntelligenceEngine

router = APIRouter()


def _clean_df(df):
    if df is None or df.empty:
        return []
    return df.where(df.notna(), None).to_dict(orient="records")


@router.get("/summary")
def get_lifecycle_summary(ai: SalesIntelligenceEngine = Depends(get_engine)):
    return ai.get_product_velocity_summary()


@router.get("/velocity")
def get_velocity(
    stage: str | None = Query(None, description="Filter by lifecycle stage"),
    ai: SalesIntelligenceEngine = Depends(get_engine),
):
    df = ai.get_velocity_data(stage_filter=stage)
    return {"status": "ok", "rows": _clean_df(df)}


@router.get("/eol")
def get_eol_predictions(
    urgency: str | None = Query(None, description="Filter: Critical, High, Medium, Low"),
    ai: SalesIntelligenceEngine = Depends(get_engine),
):
    df = ai.get_eol_predictions(urgency_filter=urgency)
    return {"status": "ok", "rows": _clean_df(df)}


@router.get("/cannibalization")
def get_cannibalization(ai: SalesIntelligenceEngine = Depends(get_engine)):
    df = ai.get_cannibalization_data()
    return {"status": "ok", "rows": _clean_df(df)}


@router.get("/trend/{product_name:path}")
def get_product_trend(
    product_name: str,
    ai: SalesIntelligenceEngine = Depends(get_engine),
):
    df = ai.get_product_trend(product_name)
    rows = _clean_df(df)
    # Convert Timestamp → ISO string for JSON
    for row in rows:
        if "sale_month" in row and row["sale_month"] is not None:
            try:
                row["sale_month"] = str(row["sale_month"])[:10]
            except Exception:
                pass
    return {"status": "ok", "rows": rows}
