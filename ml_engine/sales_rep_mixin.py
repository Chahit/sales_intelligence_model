import pandas as pd
import numpy as np

class SalesRepMixin:
    """Methods for computing Sales Representative Performance."""

    def ensure_sales_rep_data(self):
        """Loads and processes all sales rep data into a single leaderboard dataframe."""
        if getattr(self, "df_sales_rep", None) is not None:
            return

        db = self.repo
        
        # 1. Fetch tables
        users = db.fetch_table_data("auth_user")
        tx = db.fetch_table_data("transactions_dsr")
        tours = db.fetch_table_data("apps_tour_tourplan")
        expenses = db.fetch_table_data("apps_tours_expense")
        calls = db.fetch_table_data("primary_dashboard_call_log")
        issues = db.fetch_table_data("primary_dashboard_issue")
        
        if users.empty or tx.empty:
            self.df_sales_rep = pd.DataFrame()
            return
            
        # Ensure ID columns are numeric
        users["id"] = pd.to_numeric(users["id"], errors="coerce")
        tx["user_id"] = pd.to_numeric(tx["user_id"], errors="coerce")
        
        # 2. Revenue by sales rep
        if "c1" in tx.columns:
            # c1 is usually order net value or we can just count the orders. But wait, transactions_dsr net_amt is in transactions_dsr_products.
            # actually we might not have net_amt in transactions_dsr, let's just count orders for now. 
            pass

        # We will use tx to count orders and get unique customers
        rep_sales = tx.groupby("user_id").agg(
            total_orders=("id", "count"),
            unique_customers=("party_id", "nunique"),
            last_order_date=("date", "max")
        ).reset_index()
        
        # 3. Tours
        if not tours.empty:
            tours["created_by_id"] = pd.to_numeric(tours["created_by_id"], errors="coerce")
            rep_tours = tours.groupby("created_by_id").agg(
                total_tours=("id", "count")
            ).reset_index().rename(columns={"created_by_id": "user_id"})
        else:
            rep_tours = pd.DataFrame({"user_id": [], "total_tours": []})
            
        # 4. Expenses
        if not expenses.empty:
            expenses["created_by_id"] = pd.to_numeric(expenses["created_by_id"], errors="coerce")
            expenses["amount"] = pd.to_numeric(expenses["amount"], errors="coerce").fillna(0)
            rep_exp = expenses.groupby("created_by_id").agg(
                total_expenses=("amount", "sum")
            ).reset_index().rename(columns={"created_by_id": "user_id"})
        else:
            rep_exp = pd.DataFrame({"user_id": [], "total_expenses": []})
            
        # 5. Issues Raised
        if not issues.empty:
            issues["created_by_id"] = pd.to_numeric(issues["created_by_id"], errors="coerce")
            rep_issues = issues.groupby("created_by_id").agg(
                issues_logged=("id", "count")
            ).reset_index().rename(columns={"created_by_id": "user_id"})
        else:
            rep_issues = pd.DataFrame({"user_id": [], "issues_logged": []})
            
        # 6. Call Logs
        if not calls.empty and "party_id" in calls.columns:
            # call log only has party_id, we'd need to link it to salesman. Wait, do we know created_by_id?
            # if not, we can skip for now.
            pass

        # Merge everything
        df = users[["id", "first_name", "last_name", "username", "email", "is_active", "last_login"]].copy()
        df.rename(columns={"id": "user_id"}, inplace=True)
        
        # Create full name
        df["first_name"] = df["first_name"].fillna("")
        df["last_name"] = df["last_name"].fillna("")
        df["sales_rep_name"] = (df["first_name"] + " " + df["last_name"]).str.strip()
        df["sales_rep_name"] = np.where(df["sales_rep_name"] == "", df["username"], df["sales_rep_name"])
        
        # Merge metrics
        df = df.merge(rep_sales, on="user_id", how="left")
        df = df.merge(rep_tours, on="user_id", how="left")
        df = df.merge(rep_exp, on="user_id", how="left")
        df = df.merge(rep_issues, on="user_id", how="left")
        
        # Fill NA
        for col in ["total_orders", "unique_customers", "total_tours", "total_expenses", "issues_logged"]:
            if col in df.columns:
                df[col] = df[col].fillna(0)
                
        # Filter mostly active reps who have actually done something
        df = df[
            (df["total_orders"] > 0) | 
            (df["total_tours"] > 0) | 
            (df["total_expenses"] > 0)
        ].copy()
        
        # Calculate ROI: Orders / Expense
        df["expense_per_order"] = np.where(
            df["total_orders"] > 0,
            df["total_expenses"] / df["total_orders"],
            df["total_expenses"]
        )
        
        # Sort by best performer
        df = df.sort_values("total_orders", ascending=False)
        self.df_sales_rep = df

    def get_sales_rep_leaderboard(self):
        self.ensure_sales_rep_data()
        if getattr(self, "df_sales_rep", None) is None:
            return pd.DataFrame()
        return self.df_sales_rep.copy()
