import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go


def render(engine):
    st.markdown("## Sales Rep Performance Tracker")
    st.caption("Monitor field rep ROI, tours, complaints logged, and revenue generation vs targets.")

    with st.spinner("Fetching performance metrics..."):
        df = engine.get_sales_rep_leaderboard()

    if df.empty:
        st.warning("No sales rep activity logged (or data requires syncing).")
        return

    # High-level metrics
    total_reps = len(df)
    active_reps = len(df[df["total_orders"] > 0])
    total_tours = df["total_tours"].sum()
    total_expenses = df["total_expenses"].sum()

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Total Regional Reps", f"{total_reps}")
    col2.metric("Generating Revenue", f"{active_reps}")
    col3.metric("Total Area Tours", f"{int(total_tours)}")
    col4.metric("Total Expenses Logged", f"Rs {total_expenses:,.0f}")
    st.markdown("---")

    colL, colR = st.columns([2, 1])

    with colL:
        st.subheader("🏆 Sales Rep Leaderboard")
        
        # Display cleanly in a dataframe
        display_df = df[[
            "sales_rep_name", 
            "total_orders", 
            "unique_customers", 
            "total_tours", 
            "total_expenses",
            "expense_per_order",
            "issues_logged"
        ]].copy()
        
        display_df.rename(columns={
            "sales_rep_name": "Sales Rep",
            "total_orders": "Orders Closed",
            "unique_customers": "Unique Buyers",
            "total_tours": "Tours",
            "total_expenses": "Expenses Claimed (Rs)",
            "expense_per_order": "Cost per Order (Rs)",
            "issues_logged": "Partner Issues Logged"
        }, inplace=True)
        
        # Format currency cols
        display_df["Expenses Claimed (Rs)"] = display_df["Expenses Claimed (Rs)"].fillna(0).astype(int)
        display_df["Cost per Order (Rs)"] = display_df["Cost per Order (Rs)"].fillna(0).astype(int)
        
        st.dataframe(
            display_df,
            column_config={
                "Expenses Claimed (Rs)": st.column_config.NumberColumn(format="Rs %d"),
                "Cost per Order (Rs)": st.column_config.NumberColumn(format="Rs %d"),
                "Orders Closed": st.column_config.ProgressColumn(
                    format="%d",
                    min_value=0,
                    max_value=int(display_df["Orders Closed"].max()) if not display_df.empty else 100
                ),
            },
            hide_index=True,
            use_container_width=True,
            height=400
        )

    with colR:
        st.subheader("💸 ROI: Expense vs Yield")
        # Scatter plot of Expense vs Orders
        if not df.empty and df["total_expenses"].sum() > 0:
            fig = px.scatter(
                df,
                x="total_orders",
                y="total_expenses",
                color="sales_rep_name",
                size="unique_customers",
                hover_name="sales_rep_name",
                labels={
                    "total_orders": "Total Orders Closed",
                    "total_expenses": "Field Expenses (Rs)"
                },
                title="Expense vs Output (Bubble size = Unique Buyers)"
            )
            fig.update_layout(
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
                showlegend=False,
                margin=dict(l=0, r=0, t=30, b=0)
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("Not enough expense data to model correlation.")

    # Second row
    st.markdown("---")
    st.subheader("⚠️ Partner Issue Management by Rep")
    st.markdown("Reps who log complaints actively vs those who don't. High orders but 0 issues logged may indicate poor service follow-up.")
    
    # Sort by issues logged
    issue_df = df.sort_values("issues_logged", ascending=False).head(10)
    
    if issue_df["issues_logged"].sum() > 0:
        fig_issues = px.bar(
            issue_df,
            x="sales_rep_name",
            y=["issues_logged", "total_orders"],
            barmode="group",
            labels={
                "sales_rep_name": "Sales Rep",
                "value": "Count",
                "variable": "Metric"
            },
            title="Service Engagement vs Sales Volume (Top 10 Reps)"
        )
        fig_issues.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)"
        )
        st.plotly_chart(fig_issues, use_container_width=True)
    else:
        st.info("No partner issues logged by reps yet.")
