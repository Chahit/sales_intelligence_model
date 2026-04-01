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


TONE_PROMPTS = {
    "Professional": "formal, data-driven",
    "Friendly": "warm and conversational",
    "Urgent": "time-sensitive, direct",
    "Consultative": "value-focused with insight",
}


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

    results_df = result.get("results")
    if hasattr(results_df, "to_dict"):
        result["results"] = _clean_df(results_df)

    return result


@router.get("/pitch-script")
def get_pitch_script(
    partner_name: str = Query(...),
    action_sequence: int = Query(0, ge=0),
    tone: str = Query("Professional"),
    ai: SalesIntelligenceEngine = Depends(get_engine),
):
    """Generate WhatsApp / Email / Call pitch scripts for a recommendation."""
    ai.ensure_clustering()
    ai.ensure_associations()

    api_key = str(getattr(ai, "gemini_api_key", "") or "").strip()
    model = str(getattr(ai, "gemini_model", "gemini-1.5-flash"))
    tone_str = TONE_PROMPTS.get(tone, "professional")

    plan = ai.get_partner_recommendation_plan(
        partner_name=partner_name, top_n=action_sequence + 1,
        use_genai=bool(api_key), api_key=api_key or None, model=model,
    )
    recs = plan.get("recommendations", []) if plan else []
    rec = recs[action_sequence] if len(recs) > action_sequence else (recs[0] if recs else {})

    if not rec:
        return {"status": "no_data"}

    product = str(rec.get("product") or rec.get("action") or "a key product")
    gain_raw = rec.get("estimated_opportunity_value") or rec.get("expected_gain") or 0
    gain = float(gain_raw) if gain_raw else 0

    def _fmt(n: float) -> str:
        if n >= 10_000_000: return f"\u20b9{n/10_000_000:.1f}Cr"
        if n >= 100_000:    return f"\u20b9{n/100_000:.1f}L"
        if n >= 1_000:      return f"\u20b9{n/1_000:.0f}K"
        return f"\u20b9{n:.0f}"

    return {
        "status": "ok",
        "subject": f"[{tone}] Opportunity: {product}",
        "whatsapp": f"Hi \U0001f44b \u2014 we noticed *{product}* is a strong fit for your account. "
                    f"Partners like you are seeing {_fmt(gain)}/mo from it. Can we set up a quick call? \U0001f4de",
        "email": (
            f"Hi [Partner Name],\n\nI'm reaching out with a {tone_str} perspective on an opportunity "
            f"we've identified for you.\n\nBased on your account data, we believe adding *{product}* to your "
            f"portfolio could generate approximately {_fmt(gain)} in additional monthly revenue.\n\n"
            f"Partners in your segment who've made this move have seen consistent growth within 60 days.\n\n"
            f"Would you be open to a 15-minute call this week to explore this?\n\nBest,\n[Your Name]"
        ),
        "call": (
            f"\U0001f4de CALL GUIDE \u2014 {tone.upper()} TONE\n\n"
            f"1. Open: 'Hi [Partner], this is [Rep]. I'm calling about an opportunity around {product}.'\n"
            f"2. Hook: 'Partners with your profile are generating {_fmt(gain)}/month from it.'\n"
            f"3. Ask: 'Would 2pm or 4pm work for a quick call this week?'\n"
            f"4. Close: 'Great! I'll send the deck over WhatsApp now.'"
        ),
    }


@router.get("/followup-script")
def get_followup_script(
    partner_name: str = Query(...),
    action_sequence: int = Query(0, ge=0),
    no_conversion_days: int = Query(7, ge=1, le=60),
    trial_qty: int = Query(1, ge=1, le=100),
    tone: str = Query("Friendly"),
    ai: SalesIntelligenceEngine = Depends(get_engine),
):
    """Generate a follow-up script for a partner recommendation."""
    ai.ensure_clustering()
    ai.ensure_associations()

    api_key = str(getattr(ai, "gemini_api_key", "") or "").strip()
    model = str(getattr(ai, "gemini_model", "gemini-1.5-flash"))
    tone_str = TONE_PROMPTS.get(tone, "professional")

    plan = ai.get_partner_recommendation_plan(
        partner_name=partner_name, top_n=action_sequence + 1,
        use_genai=bool(api_key), api_key=api_key or None, model=model,
    )
    recs = plan.get("recommendations", []) if plan else []
    rec = recs[action_sequence] if len(recs) > action_sequence else (recs[0] if recs else {})

    product = str(rec.get("product") or rec.get("action") or "the product") if rec else "the product"

    return {
        "status": "ok",
        "whatsapp": (
            f"Hi \U0001f44b \u2014 it's been {no_conversion_days} days since we discussed *{product}*. "
            f"A trial of {trial_qty}\u00d7 units would let you test market response without any risk. "
            f"When can we confirm this? \U0001f514"
        ),
        "email": (
            f"Subject: Following Up \u2014 {product} Trial Opportunity\n\n"
            f"Hi [Partner Name],\n\nI'm following up in a {tone_str} tone on our earlier conversation about {product}.\n\n"
            f"You mentioned interest \u2014 and a trial of {trial_qty} units would be a low-risk way to validate demand.\n\n"
            f"Most partners make a decision within {no_conversion_days} days of first contact. "
            f"I'd love to lock in your allocation this week.\n\nWarm regards,\n[Your Name]"
        ),
        "call": (
            f"\U0001f4de FOLLOW-UP CALL GUIDE\n\n"
            f"1. Remind: 'Hi [Partner], calling back about the {product} opportunity.'\n"
            f"2. Progress: 'It's been {no_conversion_days} days \u2014 any questions I can answer?'\n"
            f"3. Trial: 'I can get {trial_qty} units approved on a trial basis \u2014 no commitment.'\n"
            f"4. Push: 'Can I confirm the order while I have you on the line?'"
        ),
    }


@router.get("/bundles")
def get_partner_bundles(
    partner_name: str = Query(...),
    top_n: int = Query(5, ge=1, le=20),
    ai: SalesIntelligenceEngine = Depends(get_engine),
):
    """Return FP-Growth bundle recommendations for a specific partner."""
    ai.ensure_associations()
    rules = ai.df_assoc_rules
    if rules is None or rules.empty:
        return {"status": "no_data", "rows": []}

    # Try to filter by partner purchase history if available
    df = rules.copy()
    if "lift_a_to_b" in df.columns:
        df = df.sort_values("lift_a_to_b", ascending=False)
    rows = df.head(top_n)
    return {"status": "ok", "rows": _clean_df(rows)}
