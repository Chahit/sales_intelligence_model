"""
Repository for competitor price intelligence data access.
"""

import pandas as pd
from sqlalchemy import text


class CompetitorRepository:
    """DB access layer for competitor pricing data."""

    def __init__(self, engine):
        self.engine = engine

    # ------------------------------------------------------------------
    # Tables existence check (graceful degradation if schema not applied)
    # ------------------------------------------------------------------

    def _table_exists(self, table_name: str) -> bool:
        try:
            with self.engine.connect() as conn:
                row = conn.execute(
                    text(
                        "SELECT EXISTS ("
                        "  SELECT 1 FROM information_schema.tables "
                        "  WHERE table_name = :t"
                        ")"
                    ),
                    {"t": table_name},
                ).scalar()
            return bool(row)
        except Exception:
            return False

    # ------------------------------------------------------------------
    # Read operations
    # ------------------------------------------------------------------

    def fetch_competitor_products(self) -> pd.DataFrame:
        """Fetch all competitor product prices."""
        try:
            return pd.read_sql("SELECT * FROM competitor_products ORDER BY product_name, competitor_name", self.engine)
        except Exception:
            return pd.DataFrame()

    def fetch_our_pricing(self) -> pd.DataFrame:
        """Fetch our product pricing reference."""
        try:
            return pd.read_sql("SELECT * FROM our_product_pricing ORDER BY product_name", self.engine)
        except Exception:
            return pd.DataFrame()

    def fetch_price_alerts(self, unresolved_only: bool = True) -> pd.DataFrame:
        """Fetch competitor price alerts."""
        try:
            where = "WHERE is_resolved = FALSE" if unresolved_only else ""
            return pd.read_sql(
                f"SELECT * FROM competitor_price_alerts {where} ORDER BY created_at DESC LIMIT 200",
                self.engine,
            )
        except Exception:
            return pd.DataFrame()

    def fetch_price_comparison(self) -> pd.DataFrame:
        """Build a side-by-side price comparison: our price vs. competitor prices."""
        query = """
        SELECT
            COALESCE(o.product_name, c.product_name) AS product_name,
            COALESCE(o.product_group, c.product_group) AS product_group,
            o.unit_price AS our_price,
            o.cost_price AS our_cost,
            o.margin_pct AS our_margin_pct,
            c.competitor_name,
            c.unit_price AS competitor_price,
            CASE
                WHEN o.unit_price > 0 THEN
                    ROUND(((c.unit_price - o.unit_price) / o.unit_price * 100)::numeric, 2)
                ELSE NULL
            END AS price_diff_pct,
            c.source AS competitor_source,
            c.updated_at AS competitor_updated_at
        FROM our_product_pricing o
        FULL OUTER JOIN competitor_products c
            ON LOWER(TRIM(o.product_name)) = LOWER(TRIM(c.product_name))
        ORDER BY product_name, competitor_name
        """
        try:
            return pd.read_sql(query, self.engine)
        except Exception:
            return pd.DataFrame()

    # ------------------------------------------------------------------
    # Write operations
    # ------------------------------------------------------------------

    def upsert_competitor_product(self, competitor_name: str, product_name: str,
                                   unit_price: float, product_group: str | None = None,
                                   source: str | None = None) -> int | None:
        """Insert or update a competitor product price."""
        query = text("""
            INSERT INTO competitor_products (competitor_name, product_name, unit_price, product_group, source, updated_at)
            VALUES (:competitor_name, :product_name, :unit_price, :product_group, :source, NOW())
            ON CONFLICT (competitor_name, product_name) DO UPDATE SET
                unit_price = EXCLUDED.unit_price,
                product_group = COALESCE(EXCLUDED.product_group, competitor_products.product_group),
                source = COALESCE(EXCLUDED.source, competitor_products.source),
                updated_at = NOW()
            RETURNING id
        """)
        try:
            with self.engine.begin() as conn:
                row = conn.execute(query, {
                    "competitor_name": str(competitor_name),
                    "product_name": str(product_name),
                    "unit_price": float(unit_price),
                    "product_group": product_group,
                    "source": source,
                }).first()
            return int(row[0]) if row else None
        except Exception:
            return None

    def upsert_our_product(self, product_name: str, unit_price: float,
                            product_group: str | None = None,
                            cost_price: float | None = None,
                            margin_pct: float | None = None) -> int | None:
        """Insert or update our own product pricing."""
        query = text("""
            INSERT INTO our_product_pricing (product_name, unit_price, product_group, cost_price, margin_pct, updated_at)
            VALUES (:product_name, :unit_price, :product_group, :cost_price, :margin_pct, NOW())
            ON CONFLICT (product_name) DO UPDATE SET
                unit_price = EXCLUDED.unit_price,
                product_group = COALESCE(EXCLUDED.product_group, our_product_pricing.product_group),
                cost_price = COALESCE(EXCLUDED.cost_price, our_product_pricing.cost_price),
                margin_pct = COALESCE(EXCLUDED.margin_pct, our_product_pricing.margin_pct),
                updated_at = NOW()
            RETURNING id
        """)
        try:
            with self.engine.begin() as conn:
                row = conn.execute(query, {
                    "product_name": str(product_name),
                    "unit_price": float(unit_price),
                    "product_group": product_group,
                    "cost_price": cost_price,
                    "margin_pct": margin_pct,
                }).first()
            return int(row[0]) if row else None
        except Exception:
            return None

    def create_price_alert(self, product_name: str, competitor_name: str,
                            our_price: float, competitor_price: float,
                            price_diff_pct: float, severity: str = "medium") -> int | None:
        """Create a new competitor price alert."""
        query = text("""
            INSERT INTO competitor_price_alerts
                (product_name, competitor_name, our_price, competitor_price, price_diff_pct, severity)
            VALUES (:product_name, :competitor_name, :our_price, :competitor_price, :price_diff_pct, :severity)
            RETURNING id
        """)
        try:
            with self.engine.begin() as conn:
                row = conn.execute(query, {
                    "product_name": product_name,
                    "competitor_name": competitor_name,
                    "our_price": our_price,
                    "competitor_price": competitor_price,
                    "price_diff_pct": price_diff_pct,
                    "severity": severity,
                }).first()
            return int(row[0]) if row else None
        except Exception:
            return None

    def resolve_alert(self, alert_id: int) -> bool:
        """Mark a price alert as resolved."""
        try:
            with self.engine.begin() as conn:
                conn.execute(
                    text("UPDATE competitor_price_alerts SET is_resolved = TRUE, resolved_at = NOW() WHERE id = :id"),
                    {"id": int(alert_id)},
                )
            return True
        except Exception:
            return False

    def bulk_import_competitor_csv(self, df: pd.DataFrame) -> int:
        """
        Bulk import competitor prices from a DataFrame.
        Expected columns: competitor_name, product_name, unit_price, [product_group], [source]
        """
        required = {"competitor_name", "product_name", "unit_price"}
        if not required.issubset(set(df.columns)):
            return 0
        imported = 0
        for _, row in df.iterrows():
            result = self.upsert_competitor_product(
                competitor_name=str(row["competitor_name"]),
                product_name=str(row["product_name"]),
                unit_price=float(row["unit_price"]),
                product_group=str(row.get("product_group", "")) or None,
                source=str(row.get("source", "")) or None,
            )
            if result:
                imported += 1
        return imported

    def bulk_import_our_pricing_csv(self, df: pd.DataFrame) -> int:
        """
        Bulk import our product pricing from a DataFrame.
        Expected columns: product_name, unit_price, [product_group], [cost_price], [margin_pct]
        """
        required = {"product_name", "unit_price"}
        if not required.issubset(set(df.columns)):
            return 0
        imported = 0
        for _, row in df.iterrows():
            result = self.upsert_our_product(
                product_name=str(row["product_name"]),
                unit_price=float(row["unit_price"]),
                product_group=str(row.get("product_group", "")) or None,
                cost_price=float(row["cost_price"]) if pd.notna(row.get("cost_price")) else None,
                margin_pct=float(row["margin_pct"]) if pd.notna(row.get("margin_pct")) else None,
            )
            if result:
                imported += 1
        return imported
