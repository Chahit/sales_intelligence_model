"""Recommendations router — partner recommendation plan and NL query."""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from backend.dependencies import get_engine
from ml_engine.sales_model import SalesIntelligenceEngine

router = APIRouter()


def _clean_df(df):
    if df is None or df.empty:
        return []
    return df.where(df.notna(), None).to_dict(orient="records")


class NLQueryRequest(BaseModel):
    query: str
    state_scope: str | None = None
    top_n: int = 20


@router.get("/plan")
def get_recommendation_plan(
    partner_name: str = Query(...),
    top_n: int = Query(3, ge=1, le=10),
    ai: SalesIntelligenceEngine = Depends(get_engine),
):
    """Return the AI-generated recommendation plan for a partner."""
    ai.ensure_clustering()
    ai.ensure_associations()

    api_key = str(getattr(ai, "gemini_api_key", "") or "").strip()
    model = str(getattr(ai, "gemini_model", "gemini-1.5-flash"))

    plan = ai.get_partner_recommendation_plan(
        partner_name=partner_name,
        top_n=top_n,
        use_genai=bool(api_key),
        api_key=api_key or None,
        model=model,
    )
    if not plan:
        return {"status": "no_data"}

    # Sanitise any dataframes nested in the plan
    for key in list(plan.keys()):
        val = plan[key]
        if hasattr(val, "to_dict"):
            plan[key] = _clean_df(val)

    return plan


@router.post("/nl-query")
def nl_query(
    body: NLQueryRequest,
    ai: SalesIntelligenceEngine = Depends(get_engine),
):
    """Execute a natural-language query over the recommendation engine."""
    ai.ensure_clustering()
    ai.ensure_associations()

    api_key = str(getattr(ai, "gemini_api_key", "") or "").strip()
    model = str(getattr(ai, "gemini_model", "gemini-1.5-flash"))

    result = ai.query_recommendations_nl(
        query=body.query,
        state_scope=body.state_scope,
        top_n=body.top_n,
        use_genai=bool(api_key),
        api_key=api_key or None,
        model=model,
    )
    if result is None:
        return {"status": "no_data"}

    # Sanitise results dataframe
    results_df = result.get("results")
    if hasattr(results_df, "to_dict"):
        result["results"] = _clean_df(results_df)

    return result
