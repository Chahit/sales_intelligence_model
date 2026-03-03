import streamlit as st
import pandas as pd

import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from ml_engine.services.export_service import (
    export_partner_360_pdf,
    export_partner_360_excel,
)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from styles import apply_global_styles, section_header, status_badge, banner, health_color, churn_color, page_caption


def render(ai):
    apply_global_styles()
    st.title("Partner 360 Analysis")
    page_caption("Deep-dive into any partner — revenue health, churn risk, forecast, and recommendations.")
    with st.spinner("Loading partner intelligence..."):
        ai.ensure_clustering()

    all_states = sorted(ai.matrix["state"].dropna().unique())
    selected_state = st.selectbox("Step 1: Select State/Region", all_states)

    filtered_partners = sorted(
        ai.matrix[ai.matrix["state"] == selected_state].index.unique()
    )

    if not filtered_partners:
        st.warning("No partners found in this state with recent activity.")
        return

    selected_partner = st.selectbox("Step 2: Select Partner", filtered_partners)
    report = ai.get_partner_intelligence(selected_partner)
    if not report:
        st.warning("No report available for the selected partner.")
        return

    # --- Export Buttons ---
    ex1, ex2, ex3 = st.columns([1, 1, 4])
    with ex1:
        pdf_bytes = export_partner_360_pdf(selected_partner, report)
        st.download_button(
            "\u2B07 Download PDF",
            data=pdf_bytes,
            file_name=f"Partner_360_{selected_partner.replace(' ', '_')}.pdf",
            mime="application/pdf",
            key="p360_pdf",
        )
    with ex2:
        xls_bytes = export_partner_360_excel(selected_partner, report)
        st.download_button(
            "\u2B07 Download Excel",
            data=xls_bytes,
            file_name=f"Partner_360_{selected_partner.replace(' ', '_')}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            key="p360_xlsx",
        )
    st.markdown("---")

    facts = report["facts"]
    gaps = report["gaps"]
    cluster_name = report["cluster_label"]
    cluster_type = report.get("cluster_type", "Unknown")
    cluster_info = report.get("cluster_info", "")
    playbook = report.get("playbook", {}) or {}
    alerts = report.get("alerts", []) or []

    status = facts.get("health_status", "Unknown")
    drop = float(facts.get("revenue_drop_pct", 0))
    total_pot_yearly = (
        float(gaps["Potential_Revenue_Yearly"].sum())
        if not gaps.empty and "Potential_Revenue_Yearly" in gaps.columns
        else (float(gaps["Potential_Revenue"].sum()) if not gaps.empty else 0.0)
    )
    total_pot_monthly = (
        float(gaps["Potential_Revenue_Monthly"].sum())
        if not gaps.empty and "Potential_Revenue_Monthly" in gaps.columns
        else total_pot_yearly / 12.0
    )
    total_pot_weekly = (
        float(gaps["Potential_Revenue_Weekly"].sum())
        if not gaps.empty and "Potential_Revenue_Weekly" in gaps.columns
        else total_pot_yearly / 52.0
    )
    health_segment = facts.get("health_segment", "Unknown")
    health_score = float(facts.get("health_score", 0))
    est_monthly_loss = float(facts.get("estimated_monthly_loss", 0))
    recency_days = int(facts.get("recency_days", 0))
    degrowth_flag = bool(facts.get("degrowth_flag", False))
    degrowth_threshold = float(facts.get("degrowth_threshold_pct", 20))
    churn_prob = float(facts.get("churn_probability", 0))
    churn_band = str(facts.get("churn_risk_band", "Unknown"))
    risk_90d = float(facts.get("expected_revenue_at_risk_90d", 0))
    risk_monthly = float(facts.get("expected_revenue_at_risk_monthly", 0))
    fc_next_30d = float(facts.get("forecast_next_30d", 0))
    fc_trend_pct = float(facts.get("forecast_trend_pct", 0))
    fc_conf = float(facts.get("forecast_confidence", 0))
    credit_score = float(facts.get("credit_risk_score", 0))
    credit_band = str(facts.get("credit_risk_band", "Unknown"))
    credit_util = float(facts.get("credit_utilization", 0))
    overdue_ratio = float(facts.get("overdue_ratio", 0))
    outstanding_amt = float(facts.get("outstanding_amount", 0))
    credit_adjusted_risk = float(facts.get("credit_adjusted_risk_value", 0))

    # ── Status Banner ───────────────────────────────────────────────────────
    color = health_color(status)
    churn_c = churn_color(churn_prob)
    st.markdown(
        f"<div style='display:flex;gap:12px;align-items:center;margin-bottom:18px;'>"
        f"{status_badge(f'Status: {status}', color)}"
        f"{status_badge(f'Churn: {churn_prob*100:.0f}%', churn_c)}"
        f"{status_badge(f'Segment: {cluster_type}', 'blue')}"
        f"{status_badge(cluster_name, 'grey')}"
        f"</div>",
        unsafe_allow_html=True,
    )

    # ── Section 1: Revenue Health ────────────────────────────────────────────
    section_header("Revenue Health")
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.metric("Revenue Drop", f"{drop:.1f}%", delta=f"-{drop:.1f}%", delta_color="inverse")
    with c2:
        st.metric("Unlocked Potential (Yearly)", f"Rs {int(total_pot_yearly):,}",
                  delta=f"Monthly Rs {int(total_pot_monthly):,}", delta_color="off")
    with c3:
        st.metric("Health Score", f"{health_score:.2f}")
    with c4:
        st.metric("Est. Monthly Loss", f"Rs {int(est_monthly_loss):,}")

    # ── Section 2: Churn & Forecast ──────────────────────────────────────────
    section_header("Churn & Forecast")
    c5, c6, c7, c8 = st.columns(4)
    with c5:
        st.metric("Churn Probability", f"{churn_prob * 100:.1f}%")
        st.caption(f"Risk Band: {churn_band}")
    with c6:
        st.metric("Revenue At Risk (90d)", f"Rs {int(risk_90d):,}",
                  delta=f"Monthly Rs {int(risk_monthly):,}", delta_color="off")
    with c7:
        st.metric("Forecast Next 30d", f"Rs {int(fc_next_30d):,}",
                  delta=f"Trend {fc_trend_pct:+.1f}%", delta_color="normal")
        st.caption(f"Confidence: {fc_conf:.2f}")
    with c8:
        st.metric("Last Activity", f"{recency_days}d ago")

    # ── Section 3: Credit Risk ───────────────────────────────────────────────
    section_header("Credit Risk")
    cr1, cr2, cr3, cr4 = st.columns(4)
    with cr1:
        st.metric("Credit Risk Score", f"{credit_score * 100:.1f}%",
                  delta=f"Band: {credit_band}", delta_color="off")
        st.caption(f"Utilization: {credit_util * 100:.1f}% | Overdue: {overdue_ratio * 100:.1f}%")
    with cr2:
        st.metric("Outstanding + Adj Risk",
            f"Rs {int(outstanding_amt):,}",
            delta=f"Adj Risk Rs {int(credit_adjusted_risk):,}",
            delta_color="off",
        )

    section_header("Churn Risk Explainability & Survival")
    try:
        shap_result = ai.explain_partner_churn(selected_partner)
        surv_result = ai.predict_partner_survival(selected_partner)
        shap_ok = shap_result.get("status") == "ok"
        surv_ok = surv_result.get("status") == "ok"

        if shap_ok or surv_ok:
            sa1, sa2 = st.columns(2)
            if shap_ok:
                with sa1:
                    st.markdown("**Churn Risk Factors (SHAP)**")
                    top_factors = shap_result.get("top_risk_factors", [])
                    contribs = shap_result.get("feature_contributions", {})
                    if top_factors:
                        for factor in top_factors:
                            st.write(f"— {factor}")
                    if contribs:
                        with st.expander("Full Feature Contributions", expanded=False):
                            contrib_rows = [
                                {
                                    "Feature": k,
                                    "SHAP Value": v["shap_value"],
                                    "Feature Value": v["feature_value"],
                                    "Direction": v["direction"],
                                }
                                for k, v in contribs.items()
                            ]
                            st.dataframe(
                                pd.DataFrame(contrib_rows),
                                use_container_width=True,
                                hide_index=True,
                            )
            if surv_ok:
                with sa2:
                    st.markdown("**Survival Analysis**")
                    median_days = surv_result.get("predicted_median_days_to_churn")
                    risk_text = surv_result.get("risk_assessment", "")
                    surv_probs = surv_result.get("survival_probabilities", {})
                    if median_days is not None:
                        st.metric("Predicted Days to Churn", f"{int(median_days)} days")
                    if risk_text:
                        color = "red" if "CRITICAL" in risk_text else ("orange" if "HIGH" in risk_text else "green")
                        st.markdown(f":{color}[**{risk_text}**]")
                    if surv_probs:
                        surv_rows = [
                            {"Horizon": k.replace("_", " ").title(), "Survival Probability": f"{v * 100:.1f}%"}
                            for k, v in surv_probs.items()
                        ]
                        st.dataframe(pd.DataFrame(surv_rows), use_container_width=True, hide_index=True)
        # If neither is available, show nothing (no "train model first" message)
    except Exception:
        pass  # Silently skip — churn model not trained

    st.markdown("---")

    left, right = st.columns([1, 1.5])
    with left:
        st.subheader("Retention Strategy")
        pitch = facts.get("top_affinity_pitch", None)
        pitch_conf = facts.get("pitch_confidence", None)
        pitch_lift = facts.get("pitch_lift", None)
        pitch_gain = facts.get("pitch_expected_gain", None)
        pitch_margin = facts.get("pitch_expected_margin", None)
        if pitch and pitch not in ("None", "N/A"):
            st.info(f"**Pitch This:** {pitch}")
            st.caption("Reason: Frequent buyer of associated items.")

            metric_line = []
            if pitch_conf is not None and not pd.isna(pitch_conf):
                metric_line.append(f"Confidence: {float(pitch_conf):.2f}")
            if pitch_lift is not None and not pd.isna(pitch_lift):
                metric_line.append(f"Lift: {float(pitch_lift):.2f}")
            if pitch_gain is not None and not pd.isna(pitch_gain):
                metric_line.append(f"Expected Gain: Rs {int(float(pitch_gain)):,}")
            if pitch_margin is not None and not pd.isna(pitch_margin):
                metric_line.append(f"Expected Margin: Rs {int(float(pitch_margin)):,}")
            if metric_line:
                st.caption(" | ".join(metric_line))
        else:
            st.success("No immediate missed attachments.")

        st.caption(f"Recency: {recency_days} days since last purchase")
        st.caption(f"Degrowth threshold: {degrowth_threshold:.1f}% revenue drop")

        if degrowth_flag:
            st.warning("Degrowth detected in recent 90-day window.")

        if "Healthy" not in status:
            st.error(f"Action: {status}")

    with right:
        st.subheader("Peer Gap Analysis")
        if not gaps.empty:
            st.write(f"Comparisons against **{cluster_name}** peers:")
            st.dataframe(
                gaps[
                    [
                        "Product",
                        "Potential_Revenue_Monthly",
                        "Potential_Revenue_Yearly",
                        "You_Do_Pct",
                        "Others_Do_Pct",
                        "Peer_Avg_Spend",
                    ]
                ],
                column_config={
                    "Product": "Missing Category",
                    "Potential_Revenue_Monthly": st.column_config.NumberColumn(
                        "Monthly Gap", format="Rs %d"
                    ),
                    "Potential_Revenue_Yearly": st.column_config.NumberColumn(
                        "Yearly Gap", format="Rs %d"
                    ),
                    "You_Do_Pct": st.column_config.NumberColumn(
                        "You Do", format="%.1f%%"
                    ),
                    "Others_Do_Pct": st.column_config.NumberColumn(
                        "Others Do", format="%.1f%%"
                    ),
                    "Peer_Avg_Spend": st.column_config.NumberColumn(
                        "Cluster Avg", format="Rs %d"
                    ),
                },
                use_container_width=True,
                hide_index=True,
            )
        else:
            if any(tag in str(cluster_name) for tag in ("Outlier", "Uncategorized")):
                st.warning("Partner is uncategorized (unique buying pattern).")
            else:
                st.success("Perfect account. Matches peer average.")
