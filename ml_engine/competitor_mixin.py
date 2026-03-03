"""
Competitor intelligence mixin for the SalesIntelligenceEngine.
Provides competitor price analysis, comparison, and alert generation.
"""

import numpy as np
import pandas as pd


class CompetitorMixin:
    """Competitor price intelligence: comparison, undercut detection, market positioning."""

    _competitor_loaded = False

    def ensure_competitor_data(self):
        """Load competitor and our pricing data if not already loaded."""
        if self._competitor_loaded:
            return
        try:
            self.df_competitor_products = self.competitor_repo.fetch_competitor_products()
            self.df_our_pricing = self.competitor_repo.fetch_our_pricing()
            self.df_price_comparison = self.competitor_repo.fetch_price_comparison()
            self._competitor_loaded = True
        except Exception:
            self.df_competitor_products = pd.DataFrame()
            self.df_our_pricing = pd.DataFrame()
            self.df_price_comparison = pd.DataFrame()
            self._competitor_loaded = True

    def get_price_comparison(self, product_group: str | None = None,
                              search_term: str = "") -> pd.DataFrame:
        """
        Get side-by-side price comparison between our products and competitors.
        Optionally filter by product group or search term.
        """
        self.ensure_competitor_data()
        df = self.df_price_comparison.copy() if self.df_price_comparison is not None else pd.DataFrame()
        if df.empty:
            return df

        if product_group and product_group != "All":
            df = df[df["product_group"] == product_group]

        if search_term:
            mask = df["product_name"].str.contains(search_term, case=False, na=False)
            df = df[mask]

        return df

    def get_competitor_summary(self) -> dict:
        """
        Build a summary of the competitive landscape.
        Returns competitor count, product overlap, avg price diff, undercut stats.
        """
        self.ensure_competitor_data()
        comp = self.df_competitor_products
        ours = self.df_our_pricing
        comparison = self.df_price_comparison

        summary = {
            "status": "ok",
            "our_product_count": len(ours) if ours is not None and not ours.empty else 0,
            "competitor_count": int(comp["competitor_name"].nunique()) if comp is not None and not comp.empty else 0,
            "competitor_product_entries": len(comp) if comp is not None and not comp.empty else 0,
        }

        if comparison is not None and not comparison.empty:
            matched = comparison.dropna(subset=["our_price", "competitor_price"])
            summary["matched_products"] = int(matched["product_name"].nunique())

            if not matched.empty and "price_diff_pct" in matched.columns:
                diffs = matched["price_diff_pct"].dropna()
                summary["avg_price_diff_pct"] = float(diffs.mean()) if not diffs.empty else 0.0
                summary["median_price_diff_pct"] = float(diffs.median()) if not diffs.empty else 0.0

                # Undercut = competitor is cheaper (negative diff)
                undercuts = matched[matched["price_diff_pct"] < 0]
                summary["products_undercut"] = int(undercuts["product_name"].nunique())
                summary["avg_undercut_pct"] = float(undercuts["price_diff_pct"].mean()) if not undercuts.empty else 0.0

                # Premium = competitor is more expensive (positive diff)
                premium = matched[matched["price_diff_pct"] > 0]
                summary["products_premium"] = int(premium["product_name"].nunique())
                summary["avg_premium_pct"] = float(premium["price_diff_pct"].mean()) if not premium.empty else 0.0
            else:
                summary["matched_products"] = 0
                summary["avg_price_diff_pct"] = 0.0
                summary["products_undercut"] = 0
                summary["products_premium"] = 0
        else:
            summary["matched_products"] = 0

        return summary

    def get_undercut_products(self, min_diff_pct: float = -5.0) -> pd.DataFrame:
        """
        Get products where competitors are significantly cheaper.
        min_diff_pct: threshold (e.g., -5.0 means competitor is 5%+ cheaper).
        """
        self.ensure_competitor_data()
        if self.df_price_comparison is None or self.df_price_comparison.empty:
            return pd.DataFrame()
        matched = self.df_price_comparison.dropna(subset=["our_price", "competitor_price"])
        if matched.empty or "price_diff_pct" not in matched.columns:
            return pd.DataFrame()
        undercuts = matched[matched["price_diff_pct"] <= min_diff_pct].copy()
        return undercuts.sort_values("price_diff_pct", ascending=True)

    def get_premium_products(self, min_diff_pct: float = 5.0) -> pd.DataFrame:
        """
        Get products where we are cheaper than competitors.
        min_diff_pct: threshold (e.g., 5.0 means we are 5%+ cheaper).
        """
        self.ensure_competitor_data()
        if self.df_price_comparison is None or self.df_price_comparison.empty:
            return pd.DataFrame()
        matched = self.df_price_comparison.dropna(subset=["our_price", "competitor_price"])
        if matched.empty or "price_diff_pct" not in matched.columns:
            return pd.DataFrame()
        premiums = matched[matched["price_diff_pct"] >= min_diff_pct].copy()
        return premiums.sort_values("price_diff_pct", ascending=False)

    def generate_price_alerts(self, undercut_threshold_pct: float = -10.0,
                                severe_threshold_pct: float = -20.0) -> list[dict]:
        """
        Auto-generate price alerts for significant competitor undercuts.
        Returns list of alert dicts and persists them to DB.
        """
        self.ensure_competitor_data()
        undercuts = self.get_undercut_products(min_diff_pct=undercut_threshold_pct)
        if undercuts.empty:
            return []

        alerts = []
        for _, row in undercuts.iterrows():
            diff = float(row.get("price_diff_pct", 0))
            severity = "critical" if diff <= severe_threshold_pct else "high" if diff <= undercut_threshold_pct else "medium"
            alert_id = self.competitor_repo.create_price_alert(
                product_name=str(row["product_name"]),
                competitor_name=str(row["competitor_name"]),
                our_price=float(row["our_price"]),
                competitor_price=float(row["competitor_price"]),
                price_diff_pct=diff,
                severity=severity,
            )
            alerts.append({
                "id": alert_id,
                "product_name": row["product_name"],
                "competitor_name": row["competitor_name"],
                "our_price": row["our_price"],
                "competitor_price": row["competitor_price"],
                "price_diff_pct": diff,
                "severity": severity,
            })
        return alerts

    def get_competitor_positioning_matrix(self) -> pd.DataFrame:
        """
        Build a pivot matrix: products (rows) × competitors (columns) with price values.
        Includes our pricing as the first column.
        """
        self.ensure_competitor_data()
        if self.df_price_comparison is None or self.df_price_comparison.empty:
            return pd.DataFrame()

        comp = self.df_price_comparison.dropna(subset=["product_name"])
        if comp.empty:
            return pd.DataFrame()

        # Build pivot: one row per product, columns = competitors
        pivot_parts = []

        # Our prices
        ours = comp.drop_duplicates(subset=["product_name"])[["product_name", "our_price"]].dropna()
        if not ours.empty:
            ours = ours.set_index("product_name").rename(columns={"our_price": "Our Price"})
            pivot_parts.append(ours)

        # Competitor prices
        for cname in comp["competitor_name"].dropna().unique():
            sub = comp[comp["competitor_name"] == cname][["product_name", "competitor_price"]].copy()
            sub = sub.drop_duplicates(subset=["product_name"]).set_index("product_name")
            sub = sub.rename(columns={"competitor_price": str(cname)})
            pivot_parts.append(sub)

        if not pivot_parts:
            return pd.DataFrame()

        result = pivot_parts[0]
        for p in pivot_parts[1:]:
            result = result.join(p, how="outer")

        return result.reset_index().rename(columns={"index": "product_name"})

    def import_competitor_data(self, df: pd.DataFrame) -> int:
        """Bulk import competitor pricing from uploaded DataFrame."""
        return self.competitor_repo.bulk_import_competitor_csv(df)

    def import_our_pricing_data(self, df: pd.DataFrame) -> int:
        """Bulk import our pricing from uploaded DataFrame."""
        return self.competitor_repo.bulk_import_our_pricing_csv(df)

    def get_price_alerts(self, unresolved_only: bool = True) -> pd.DataFrame:
        """Fetch price alerts from DB."""
        return self.competitor_repo.fetch_price_alerts(unresolved_only=unresolved_only)

    def resolve_price_alert(self, alert_id: int) -> bool:
        """Mark a price alert as resolved."""
        return self.competitor_repo.resolve_alert(alert_id)
