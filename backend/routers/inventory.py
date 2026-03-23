"""Inventory Liquidation router — dead stock list and stock details."""
from fastapi import APIRouter, Depends, HTTPException
from backend.dependencies import get_engine
from ml_engine.sales_model import SalesIntelligenceEngine

router = APIRouter()


def _clean_df(df):
    if df is None or df.empty:
        return []
    return df.where(df.notna(), None).to_dict(orient="records")


@router.get("/dead-stock")
def get_dead_stock(ai: SalesIntelligenceEngine = Depends(get_engine)):
    """Return the list of dead/slow-moving stock items."""
    ai.ensure_core_loaded()
    df = ai.df_dead_stock
    if df is None or df.empty:
        return {"status": "no_data", "items": [], "item_names": []}

    items = []
    if "product_name" in df.columns:
        items = sorted(df["product_name"].dropna().unique().tolist())
    elif "item_name" in df.columns:
        items = sorted(df["item_name"].dropna().unique().tolist())

    return {
        "status": "ok",
        "item_names": items,
        "items": _clean_df(df),
    }


@router.get("/stock-details/{item_name:path}")
def get_stock_details(
    item_name: str,
    ai: SalesIntelligenceEngine = Depends(get_engine),
):
    """Return metrics for a specific dead stock item."""
    ai.ensure_core_loaded()
    details = ai.get_stock_details(item_name)
    if details is None:
        raise HTTPException(status_code=404, detail=f"No stock data for '{item_name}'")
    return details
