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
    # This populates df_dead_stock from the materialized view
    df = ai.get_dead_stock()

    # Fallback: if materialized view empty, use df_stock_stats (age > 60d, qty > 10)
    if (df is None or df.empty) and ai.df_stock_stats is not None and not ai.df_stock_stats.empty:
        ss = ai.df_stock_stats.copy()
        age_col = "max_age_days" if "max_age_days" in ss.columns else None
        qty_col = "total_stock_qty" if "total_stock_qty" in ss.columns else None
        if age_col and qty_col:
            mask = (ss[age_col] > 60) & (ss[qty_col] > 10)
            df = ss[mask].copy()
            if "product_name" not in df.columns and "item_name" in df.columns:
                df = df.rename(columns={"item_name": "product_name"})

    if df is None or df.empty:
        return {"status": "no_data", "items": [], "item_names": []}

    # Normalise column names for frontend: ensure product_name exists
    if "dead_stock_item" in df.columns and "product_name" not in df.columns:
        df = df.rename(columns={"dead_stock_item": "product_name"})

    items = []
    if "product_name" in df.columns:
        items = sorted(df["product_name"].dropna().unique().tolist())

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
