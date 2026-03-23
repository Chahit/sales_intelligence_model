"""
FastAPI backend — AI Sales Intelligence Suite
Wraps the existing SalesIntelligenceEngine and exposes REST endpoints.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import (
    partner,
    clustering,
    inventory,
    lifecycle,
    recommendations,
    sales_rep,
    market_basket,
    pipeline,
    chat,
    monitoring,
)
from backend.dependencies import get_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm up the AI engine singleton on startup."""
    engine = get_engine()
    engine.ensure_core_loaded()
    print("✅ SalesIntelligenceEngine ready.")
    yield


app = FastAPI(
    title="AI Sales Intelligence API",
    version="1.0.0",
    description="FastAPI backend for the AI Sales Intelligence Suite",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(partner.router,         prefix="/api/partner",          tags=["Partner 360"])
app.include_router(clustering.router,      prefix="/api/clustering",       tags=["Clustering"])
app.include_router(inventory.router,       prefix="/api/inventory",        tags=["Inventory"])
app.include_router(lifecycle.router,       prefix="/api/lifecycle",        tags=["Product Lifecycle"])
app.include_router(recommendations.router, prefix="/api/recommendations",  tags=["Recommendations"])
app.include_router(sales_rep.router,       prefix="/api/sales-rep",        tags=["Sales Rep"])
app.include_router(market_basket.router,   prefix="/api/market-basket",    tags=["Market Basket"])
app.include_router(pipeline.router,        prefix="/api/pipeline",         tags=["Pipeline"])
app.include_router(chat.router,            prefix="/api/chat",             tags=["Chat"])
app.include_router(monitoring.router,      prefix="/api/monitoring",       tags=["Monitoring"])


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "AI Sales Intelligence API v1.0.0"}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}
