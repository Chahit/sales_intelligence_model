"""Chat router — AI chatbot query endpoint."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from backend.dependencies import get_engine
from ml_engine.sales_model import SalesIntelligenceEngine

router = APIRouter()


class ChatRequest(BaseModel):
    query: str
    history: list[dict] | None = None


@router.post("/query")
def chat_query(body: ChatRequest, ai: SalesIntelligenceEngine = Depends(get_engine)):
    """Send a question to the AI chatbot and get a response."""
    ai.ensure_clustering()

    api_key = str(getattr(ai, "gemini_api_key", "") or "").strip()
    model = str(getattr(ai, "gemini_model", "gemini-1.5-flash"))

    try:
        result = ai.answer_question(
            question=body.query,
            use_genai=bool(api_key),
            api_key=api_key or None,
            model=model,
        )
    except Exception as e:
        return {"status": "error", "answer": str(e)}

    if isinstance(result, dict):
        return result
    return {"status": "ok", "answer": str(result)}
