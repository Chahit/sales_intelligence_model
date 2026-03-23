"""
Singleton dependency for the SalesIntelligenceEngine.
FastAPI routes call get_engine() to get the shared, cached instance.
"""
import sys
import os

# Make sure the project root is on the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ml_engine.sales_model import SalesIntelligenceEngine

_engine: SalesIntelligenceEngine | None = None


def get_engine() -> SalesIntelligenceEngine:
    """Return the shared singleton instance (created once on first call)."""
    global _engine
    if _engine is None:
        _engine = SalesIntelligenceEngine()
    return _engine
