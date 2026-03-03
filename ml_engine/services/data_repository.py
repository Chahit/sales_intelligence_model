import pandas as pd


class DataRepository:
    """DB access layer for read-heavy dashboard workloads."""

    def __init__(self, engine):
        self.engine = engine

    def fetch_view_ml_input(self):
        return pd.read_sql("SELECT * FROM view_ml_input", self.engine)

    def fetch_fact_sales_intelligence(self):
        return pd.read_sql("SELECT * FROM fact_sales_intelligence", self.engine).set_index(
            "company_name"
        )

    def fetch_view_ageing_stock(self):
        return pd.read_sql(
            "SELECT product_name, total_stock_qty, max_age_days FROM view_ageing_stock",
            self.engine,
        )

    def fetch_view_product_associations(self, limit=2000):
        return pd.read_sql(
            f"SELECT * FROM view_product_associations ORDER BY times_bought_together DESC LIMIT {int(limit)}",
            self.engine,
        )

    def fetch_view_stock_liquidation_leads(self):
        return pd.read_sql("SELECT * FROM view_stock_liquidation_leads", self.engine)

    def fetch_table_data(self, table_name):
        """Generic table fetcher for raw data modeling"""
        try:
            return pd.read_sql(f"SELECT * FROM {table_name}", self.engine)
        except Exception as e:
            print(f"Error fetching {table_name}: {e}")
            return pd.DataFrame()
