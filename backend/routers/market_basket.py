"""Market Basket router — association rules."""
from fastapi import APIRouter, Depends, Query
from backend.dependencies import get_engine
from ml_engine.sales_model import SalesIntelligenceEngine

router = APIRouter()


def _clean_df(df):
    if df is None or df.empty:
        return []
    return df.where(df.notna(), None).to_dict(orient="records")


@router.get("/rules")
def get_rules(
    min_confidence: float = Query(0.15, ge=0.0, le=1.0),
    min_lift: float = Query(1.0, ge=0.0),
    min_support: int = Query(5, ge=1),
    search: str | None = Query(None),
    ai: SalesIntelligenceEngine = Depends(get_engine),
):
    """Return filtered association rules."""
    ai.ensure_associations()
    rules = ai.df_assoc_rules
    if rules is None or rules.empty:
        return {"status": "no_data", "rows": [], "total": 0}

    filtered = rules.copy()

    if "confidence_a_to_b" in filtered.columns:
        filtered = filtered[filtered["confidence_a_to_b"] >= min_confidence]
    if "lift_a_to_b" in filtered.columns:
        filtered = filtered[filtered["lift_a_to_b"] >= min_lift]
    if "support_a" in filtered.columns:
        filtered = filtered[filtered["support_a"] >= min_support]
    if search and ("product_a" in filtered.columns):
        mask = (
            filtered["product_a"].str.contains(search, case=False, na=False)
            | filtered["product_b"].str.contains(search, case=False, na=False)
        )
        filtered = filtered[mask]

    return {
        "status": "ok",
        "total": len(filtered),
        "rows": _clean_df(filtered),
    }


@router.get("/cross-sell/{product_name:path}")
def get_cross_sell(
    product_name: str,
    top_n: int = Query(5, ge=1, le=20),
    ai: SalesIntelligenceEngine = Depends(get_engine),
):
    """Return top cross-sell suggestions for a given product."""
    ai.ensure_associations()
    rules = ai.df_assoc_rules
    if rules is None or rules.empty:
        return {"status": "no_data", "rows": []}

    mask = (
        rules.get("product_a", rules.get("item_a", "")).str.lower()
        == product_name.lower()
    )
    suggestions = rules[mask].nlargest(top_n, "lift_a_to_b") if "lift_a_to_b" in rules.columns else rules[mask].head(top_n)
    return {"status": "ok", "rows": _clean_df(suggestions)}


@router.get("/partner-recs")
def get_partner_recs(
    partner_name: str = Query(..., description="Partner name"),
    min_confidence: float = Query(0.15, ge=0.0, le=1.0),
    min_lift: float = Query(1.0, ge=0.0),
    min_support: int = Query(5, ge=1),
    top_n: int = Query(20, ge=1, le=100),
    ai: SalesIntelligenceEngine = Depends(get_engine),
):
    """Return association-rule-based cross-sell recommendations for a specific partner."""
    ai.ensure_associations()
    rules = ai.df_assoc_rules
    if rules is None or rules.empty:
        return {"status": "no_data", "rows": []}

    df = rules.copy()

    # Apply quality filters
    if "confidence_a_to_b" in df.columns:
        df = df[df["confidence_a_to_b"] >= min_confidence]
    if "lift_a_to_b" in df.columns:
        df = df[df["lift_a_to_b"] >= min_lift]
    if "support_a" in df.columns:
        df = df[df["support_a"] >= min_support]

    # If partner transaction data available, filter to products partner already buys
    if hasattr(ai, "df_transactions") and ai.df_transactions is not None:
        txn = ai.df_transactions
        partner_col = next((c for c in ["partner_name", "company_name", "customer_name"] if c in txn.columns), None)
        item_col = next((c for c in ["item_name", "product_name", "product"] if c in txn.columns), None)
        if partner_col and item_col:
            bought = set(
                txn[txn[partner_col].str.lower() == partner_name.lower()][item_col]
                .dropna().str.lower().unique()
            )
            if bought and "product_a" in df.columns:
                df = df[df["product_a"].str.lower().isin(bought)]

    # Sort by lift and return top N
    if "lift_a_to_b" in df.columns:
        df = df.sort_values("lift_a_to_b", ascending=False)
    return {"status": "ok", "rows": _clean_df(df.head(top_n))}
