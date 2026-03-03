import pandas as pd
import streamlit as st

import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from ml_engine.services.export_service import (
    export_recommendation_plan_pdf,
    export_recommendation_plan_excel,
)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from styles import apply_global_styles, section_header, page_caption, banner


def render(ai):
    apply_global_styles()
    st.title("Recommendation Hub")
    page_caption("Partner-specific action plan powered by cluster, churn, credit, peer gaps, and affinity signals.")
    with st.spinner("Loading recommendation context..."):
        ai.ensure_clustering()
        if ai.enable_realtime_partner_scoring:
            ai.ensure_churn_forecast()
            ai.ensure_credit_risk()
            ai.ensure_associations()

    if ai.matrix is None or ai.matrix.empty:
        st.warning("No partner matrix available. Refresh data and try again.")
        return

    states = sorted(ai.matrix["state"].dropna().unique().tolist())
    selected_state = st.selectbox("State / Region", states)
    partner_list = sorted(ai.matrix[ai.matrix["state"] == selected_state].index.unique().tolist())
    if not partner_list:
        st.warning("No partners found for selected state.")
        return

    selected_partner = st.selectbox("Partner", partner_list)
    top_n = st.slider("Top Actions", 1, 5, 3, 1)

    # ────────────────────────────── Tabs ──────────────────────────────────────
    tab_rec, tab_nl, tab_adv = st.tabs(["📋 Recommendations", "🔍 NL Query", "⚙️ Advanced"])

    # ── Tab 2: NL Query ───────────────────────────────────────────────────────
    with tab_nl:
        section_header("Natural Language Query over Recommendations")
        st.caption("Example: Show high-margin recommendations for low-credit-risk VIPs in Delhi.")
        nq1, nq2 = st.columns([2, 1])
        with nq1:
            nl_query = st.text_input(
                "Ask in plain language",
                value="",
                placeholder="Show high-margin recommendations for low-credit-risk VIPs in Delhi",
                key="nl_query_input",
            )
        with nq2:
            nl_scope = st.selectbox(
                "Search Scope",
                ["Selected State", "All States"],
                index=0,
                key="nl_scope",
            )
        nq3, nq5 = st.columns(2)
        with nq3:
            nl_top_n = st.slider("NL Query Top N", 5, 100, 20, 5)
        with nq5:
            st.write("")
            st.write("")
            nl_run = st.button("Run NL Query")
    # ── Tab 3: Advanced ───────────────────────────────────────────────────────
    with tab_adv:
        model_name_adv = str(getattr(ai, "gemini_model", "gemini-1.5-flash"))
        key_adv = str(getattr(ai, "gemini_api_key", "")).strip()
        if key_adv:
            st.caption(f"Gemini Model: {model_name_adv} (enabled via environment)")
        else:
            st.info("GEMINI_API_KEY not configured. Enhanced AI narrative unavailable, but all deterministic logic still runs.")

    # ── Tab 1: Recommendations ────────────────────────────────────────────────
    with tab_rec:
        model_name = str(getattr(ai, "gemini_model", "gemini-1.5-flash"))
        model_fallbacks = str(getattr(ai, "gemini_model_fallbacks", "") or "").strip()
        key = str(getattr(ai, "gemini_api_key", "")).strip()
        nl_query = st.session_state.get("nl_query_input", "")
        nl_run = False  # handled in NL tab


    if nl_run and str(nl_query).strip():
        nl_result = ai.query_recommendations_nl(
            query=nl_query,
            state_scope=selected_state if nl_scope == "Selected State" else None,
            top_n=int(nl_top_n),
            use_genai=True,
            api_key=key if key else None,
            model=model_name,
        )
        if not nl_result or nl_result.get("status") != "ok":
            st.error(
                nl_result.get("reason", "Query execution failed.")
                if isinstance(nl_result, dict)
                else "Query execution failed."
            )
        else:
            parser = nl_result.get("parser", {}) or {}
            filters = nl_result.get("filters", {}) or {}
            st.info(
                f"Matched {int(nl_result.get('total_matches', 0))} recommendation rows "
                f"(showing top {int(filters.get('top_n', nl_top_n))}); "
                f"scanned {int(nl_result.get('scanned_partners', 0))} of "
                f"{int(nl_result.get('candidate_partners', 0))} candidate partners. "
                f"Parser: {parser.get('mode', 'heuristic')}."
            )
            if parser.get("genai_error"):
                st.warning(parser.get("genai_error"))
            with st.expander("Structured Filters Used", expanded=False):
                st.json(filters)

            nl_df = nl_result.get("results", pd.DataFrame())
            if isinstance(nl_df, pd.DataFrame) and not nl_df.empty:
                cols = [
                    "partner_name",
                    "state",
                    "cluster_label",
                    "cluster_type",
                    "health_segment",
                    "action_type",
                    "recommended_offer",
                    "priority_score",
                    "margin_rate",
                    "safe_discount_pct",
                    "churn_probability",
                    "credit_risk_score",
                ]
                show = [c for c in cols if c in nl_df.columns]
                st.dataframe(
                    nl_df[show],
                    column_config={
                        "priority_score": st.column_config.NumberColumn("Priority", format="%.2f"),
                        "margin_rate": st.column_config.NumberColumn("Margin Rate", format="%.2f"),
                        "safe_discount_pct": st.column_config.NumberColumn("Safe Discount %", format="%.1f"),
                        "churn_probability": st.column_config.NumberColumn("Churn", format="%.3f"),
                        "credit_risk_score": st.column_config.NumberColumn("Credit Risk", format="%.3f"),
                    },
                    use_container_width=True,
                    hide_index=True,
                )
            else:
                st.warning("No recommendations matched the requested filters.")

    plan = ai.get_partner_recommendation_plan(
        partner_name=selected_partner,
        top_n=int(top_n),
        use_genai=True,
        api_key=key if key else None,
        model=model_name,
    )

    if not plan or plan.get("status") != "ok":
        st.error(plan.get("reason", "Recommendation plan unavailable.") if isinstance(plan, dict) else "Recommendation plan unavailable.")
        return

    # --- Export Buttons ---
    rex1, rex2, rex3 = st.columns([1, 1, 4])
    with rex1:
        reco_pdf = export_recommendation_plan_pdf(selected_partner, plan)
        st.download_button(
            "\u2B07 Download PDF",
            data=reco_pdf,
            file_name=f"Reco_Plan_{selected_partner.replace(' ', '_')}.pdf",
            mime="application/pdf",
            key="reco_pdf",
        )
    with rex2:
        reco_xls = export_recommendation_plan_excel(selected_partner, plan)
        st.download_button(
            "\u2B07 Download Excel",
            data=reco_xls,
            file_name=f"Reco_Plan_{selected_partner.replace(' ', '_')}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            key="reco_xlsx",
        )

    st.markdown("---")
    c1, c2 = st.columns(2)
    with c1:
        st.metric("Partner", str(plan.get("partner_name", selected_partner)))
    with c2:
        st.metric(
            "Segment",
            f"{plan.get('cluster_label', 'Unknown')} ({plan.get('cluster_type', 'Unknown')})",
        )
    st.info(f"Suggested Sequence: {plan.get('sequence_summary', 'N/A')}")

    actions = plan.get("actions", []) or []
    st.subheader("Top Recommended Actions")
    if not actions:
        st.warning("No recommendations generated.")
    else:
        df = pd.DataFrame(actions)
        show_cols = [
            "sequence",
            "action_type",
            "recommended_offer",
            "priority_score",
            "why_relevant",
            "suggested_sequence",
        ]
        keep = [c for c in show_cols if c in df.columns]
        st.dataframe(
            df[keep],
            column_config={
                "sequence": st.column_config.NumberColumn("Seq"),
                "action_type": "Action Type",
                "recommended_offer": "Recommended Offer",
                "priority_score": st.column_config.NumberColumn("Priority Score", format="%.2f"),
                "why_relevant": "Why Relevant",
                "suggested_sequence": "Execution Guidance",
            },
            use_container_width=True,
            hide_index=True,
        )

    explanation = plan.get("plain_language_explanation", {}) or {}

    # ======================================================================
    # Enhanced Recommendations (Bandits + Collaborative + Learned Scoring)
    # ======================================================================
    st.markdown("---")
    enh_tab, nba_tab = st.tabs(["Enhanced AI Recommendations", "Next Best Action (Journey)"])

    with enh_tab:
        st.caption(
            "Uses contextual bandits, collaborative filtering, learned priority scoring, and diversity constraints."
        )
        if st.button("Generate Enhanced Plan", key="btn_enhanced_reco"):
            with st.spinner("Running enhanced recommendation engine..."):
                try:
                    enh_plan = ai.get_enhanced_recommendation_plan(
                        partner_name=selected_partner,
                        top_n=int(top_n),
                        use_genai=True,
                        api_key=key if key else None,
                        model=model_name,
                    )
                    if enh_plan and enh_plan.get("status") == "ok":
                        upgrades = enh_plan.get("upgrades_applied", [])
                        st.success(f"Upgrades applied: {', '.join(upgrades)}")

                        enh_actions = enh_plan.get("actions", [])
                        if enh_actions:
                            enh_df = pd.DataFrame(enh_actions)
                            enh_cols = [c for c in [
                                "sequence", "action_type", "recommended_offer",
                                "priority_score", "why_relevant",
                            ] if c in enh_df.columns]
                            st.dataframe(
                                enh_df[enh_cols],
                                column_config={
                                    "sequence": st.column_config.NumberColumn("Seq"),
                                    "priority_score": st.column_config.NumberColumn("Priority", format="%.2f"),
                                },
                                use_container_width=True,
                                hide_index=True,
                            )

                        collab = enh_plan.get("collaborative_recommendations", [])
                        if collab:
                            with st.expander("Collaborative Filtering Signals", expanded=False):
                                for cr in collab[:5]:
                                    st.write(
                                        f"- **{cr.get('product', 'Product')}** "
                                        f"(score: {float(cr.get('collab_score', 0)):.2f}, "
                                        f"similar buyers: {cr.get('peer_count', '?')})"
                                    )

                        if enh_plan.get("genai"):
                            st.info(enh_plan["genai"])
                        if enh_plan.get("genai_error"):
                            st.warning(enh_plan["genai_error"])
                    else:
                        st.warning(
                            enh_plan.get("reason", "Enhanced plan unavailable.")
                            if isinstance(enh_plan, dict)
                            else "Enhanced plan unavailable."
                        )
                except Exception as e:
                    st.error(f"Enhanced recommendation error: {e}")

    with nba_tab:
        st.caption(
            "Dynamic multi-step journey: the next action adapts based on what happened previously."
        )
        nba1, nba2, nba3 = st.columns(3)
        with nba1:
            prev_outcome = st.selectbox(
                "Previous Outcome",
                ["(First Contact)", "accepted", "rejected", "won", "lost", "no_response"],
                index=0,
                key="nba_outcome",
            )
        with nba2:
            prev_action = st.text_input(
                "Previous Action (if any)",
                value="",
                placeholder="e.g. Cross-sell Bundle A",
                key="nba_prev_action",
            )
        with nba3:
            nba_top_n = st.slider("Actions", 1, 5, 3, 1, key="nba_top_n")

        if st.button("Get Next Best Action", key="btn_nba"):
            with st.spinner("Computing journey-aware recommendation..."):
                try:
                    outcome_val = None if prev_outcome == "(First Contact)" else prev_outcome
                    nba_result = ai.get_partner_next_best_action(
                        partner_name=selected_partner,
                        previous_outcome=outcome_val,
                        previous_action_type=prev_action if prev_action.strip() else None,
                        top_n=int(nba_top_n),
                    )
                    if nba_result and nba_result.get("status") == "ok":
                        journey = nba_result.get("journey_stage", "initial")
                        guidance = nba_result.get("journey_guidance", "")
                        st.info(f"**Journey Stage: {journey.upper()}** — {guidance}")

                        nba_actions = nba_result.get("actions", [])
                        if nba_actions:
                            nba_df = pd.DataFrame(nba_actions)
                            nba_cols = [c for c in [
                                "sequence", "action_type", "recommended_offer",
                                "priority_score", "why_relevant", "suggested_sequence",
                            ] if c in nba_df.columns]
                            st.dataframe(
                                nba_df[nba_cols],
                                column_config={
                                    "sequence": st.column_config.NumberColumn("Seq"),
                                    "priority_score": st.column_config.NumberColumn("Priority", format="%.2f"),
                                },
                                use_container_width=True,
                                hide_index=True,
                            )

                        collab = nba_result.get("collaborative_recommendations", [])
                        if collab:
                            with st.expander("Similar Partners Also Bought", expanded=False):
                                for cr in collab[:5]:
                                    st.write(
                                        f"- **{cr.get('product', 'Product')}** "
                                        f"(score: {float(cr.get('collab_score', 0)):.2f})"
                                    )
                    else:
                        st.warning(
                            nba_result.get("reason", "Next best action unavailable.")
                            if isinstance(nba_result, dict)
                            else "Next best action unavailable."
                        )
                except Exception as e:
                    st.error(f"Next best action error: {e}")

    st.markdown("---")
    if explanation:
        st.markdown("---")
        st.subheader("Recommendation Explanation (Plain Language)")
        summary = str(explanation.get("summary", "")).strip()
        if summary:
            st.info(summary)
        reasons = explanation.get("reasons", []) or []
        if reasons:
            for idx, reason in enumerate(reasons, start=1):
                st.write(f"{idx}. {reason}")

        signals = explanation.get("model_signals", {}) or {}
        if signals:
            s1, s2, s3 = st.columns(3)
            with s1:
                st.metric(
                    "Peer Gap (Top Category)",
                    f"{float(signals.get('peer_gap_delta_pct', 0.0)):.1f}%",
                )
            with s2:
                st.metric(
                    "Churn Probability",
                    f"{float(signals.get('churn_probability', 0.0)) * 100:.1f}%",
                )
            with s3:
                st.metric(
                    "Credit Risk",
                    f"{float(signals.get('credit_risk_score', 0.0)) * 100:.1f}%",
                )

    st.markdown("---")
    st.subheader("Auto-generated Pitch Scripts")
    if not actions:
        st.info("Generate recommendations first to create pitch drafts.")
    else:
        seq_options = [int(a.get("sequence", i + 1)) for i, a in enumerate(actions)]
        selected_seq = st.selectbox("Pick Recommendation Sequence", seq_options, index=0)
        tone = st.selectbox("Tone", ["formal", "friendly", "urgent"], index=0)

        script_pack = ai.get_partner_pitch_scripts(
            partner_name=selected_partner,
            action_sequence=int(selected_seq),
            tone=tone,
            use_genai=True,
            api_key=key if key else None,
            model=model_name,
        )
        if not script_pack or script_pack.get("status") != "ok":
            st.warning(
                script_pack.get("reason", "Pitch script generation unavailable.")
                if isinstance(script_pack, dict)
                else "Pitch script generation unavailable."
            )
        else:
            pricing = script_pack.get("pricing", {}) or {}
            p1, p2, p3 = st.columns(3)
            with p1:
                st.metric("Offer", str(pricing.get("offer_name", "Recommended Offer")))
            with p2:
                unit_price = pricing.get("unit_price", None)
                if unit_price is not None and pd.notna(unit_price):
                    st.metric("Indicative Price", f"Rs {int(float(unit_price)):,}")
                else:
                    st.metric("Indicative Price", "Rate Card")
            with p3:
                st.metric(
                    "Margin-safe Offer",
                    f"{float(pricing.get('safe_discount_pct', 0.0)):.0f}% off",
                )

            scripts = script_pack.get("scripts", {}) or {}
            st.text_area(
                "WhatsApp Draft",
                value=str(scripts.get("whatsapp", "")),
                height=170,
            )
            st.text_input(
                "Email Subject",
                value=str(scripts.get("email_subject", "")),
            )
            st.text_area(
                "Email Body",
                value=str(scripts.get("email_body", "")),
                height=230,
            )

            st.markdown("**Gemini-enhanced Version**")
            if script_pack.get("genai_error"):
                st.warning(script_pack.get("genai_error"))
            if script_pack.get("genai"):
                st.write(script_pack.get("genai"))

        st.markdown("---")
        st.subheader("Follow-up Message Generator")
        st.caption(
            "If no conversion in X days, generate revised follow-up with alternate bundle or smaller trial quantity."
        )
        c1, c2, c3 = st.columns(3)
        with c1:
            no_conversion_days = st.number_input(
                "No Conversion Days",
                min_value=1,
                max_value=90,
                value=7,
                step=1,
            )
        with c2:
            trial_qty = st.number_input(
                "Trial Quantity",
                min_value=1,
                max_value=500,
                value=5,
                step=1,
            )
        with c3:
            followup_tone = st.selectbox("Follow-up Tone", ["formal", "friendly", "urgent"], index=0)

        followup_pack = ai.get_partner_followup_scripts(
            partner_name=selected_partner,
            action_sequence=int(selected_seq),
            tone=followup_tone,
            no_conversion_days=int(no_conversion_days),
            trial_qty=int(trial_qty),
            use_genai=True,
            api_key=key if key else None,
            model=model_name,
        )

        if not followup_pack or followup_pack.get("status") != "ok":
            st.warning(
                followup_pack.get("reason", "Follow-up generation unavailable.")
                if isinstance(followup_pack, dict)
                else "Follow-up generation unavailable."
            )
        else:
            f1, f2, f3 = st.columns(3)
            with f1:
                st.metric("No Conversion Window", f"{int(no_conversion_days)} day(s)")
            with f2:
                st.metric("Trial Quantity", str(int(trial_qty)))
            with f3:
                alt_offer = str(followup_pack.get("alternate_offer", "") or "").strip()
                if alt_offer:
                    st.metric("Alternate Bundle", alt_offer)
                else:
                    st.metric("Alternate Bundle", "Fallback: smaller trial")

            followup = followup_pack.get("followup", {}) or {}
            st.text_area(
                "WhatsApp Follow-up",
                value=str(followup.get("whatsapp_followup", "")),
                height=180,
            )
            st.text_input(
                "Follow-up Email Subject",
                value=str(followup.get("email_subject_followup", "")),
            )
            st.text_area(
                "Follow-up Email Body",
                value=str(followup.get("email_body_followup", "")),
                height=240,
            )

            st.markdown("**Gemini-enhanced Follow-up**")
            if followup_pack.get("genai_error"):
                st.warning(followup_pack.get("genai_error"))
            if followup_pack.get("genai"):
                st.write(followup_pack.get("genai"))

        st.markdown("---")
        st.subheader("Feedback-to-Learning Loop")
        st.caption(
            "Mark recommendation outcomes and learn weekly which recommendation types and messaging styles convert better."
        )

        with st.form("recommendation_feedback_form", clear_on_submit=False):
            fb1, fb2, fb3 = st.columns(3)
            with fb1:
                outcome = st.selectbox("Outcome", ["accepted", "rejected", "won", "lost"], index=0)
                stage = st.selectbox("Stage", ["initial_pitch", "followup"], index=0)
            with fb2:
                channel = st.selectbox("Channel", ["whatsapp", "email", "call", "in_person"], index=0)
                feedback_tone = st.selectbox("Messaging Style (Tone)", ["formal", "friendly", "urgent"], index=0)
            with fb3:
                st.write("")
                st.write("")
                submitted = st.form_submit_button("Save Feedback")
            feedback_notes = st.text_area(
                "Outcome Notes (optional)",
                value="",
                height=90,
                help="Example: customer asked for lower qty trial, price objection, credit hold, etc.",
            )

            if submitted:
                save = ai.record_recommendation_feedback(
                    partner_name=selected_partner,
                    action_sequence=int(selected_seq),
                    outcome=outcome,
                    stage=stage,
                    channel=channel,
                    tone=feedback_tone,
                    notes=feedback_notes,
                )
                if save and save.get("status") == "ok":
                    st.success(f"Feedback saved (id={save.get('feedback_id')}).")
                else:
                    st.error(
                        save.get("reason", "Failed to save feedback.")
                        if isinstance(save, dict)
                        else "Failed to save feedback."
                    )

        lw1, lw3 = st.columns(2)
        with lw1:
            learning_window = st.slider("Learning Window (days)", min_value=7, max_value=90, value=7, step=1)
        with lw3:
            st.write("")
            st.write("")
            refresh_learning = st.button("Refresh Learning Summary")

        learning = ai.get_weekly_feedback_learning_summary(
            lookback_days=int(learning_window),
            use_genai=True,
            api_key=key if key else None,
            model=model_name,
        )
        if refresh_learning:
            learning = ai.get_weekly_feedback_learning_summary(
                lookback_days=int(learning_window),
                use_genai=True,
                api_key=key if key else None,
                model=model_name,
            )

        if not learning or learning.get("status") != "ok":
            st.warning(
                learning.get("reason", "Learning summary unavailable.")
                if isinstance(learning, dict)
                else "Learning summary unavailable."
            )
        else:
            st.write(f"Events analyzed: **{int(learning.get('total_events', 0))}**")
            lines = learning.get("summary_lines", []) or []
            for idx, line in enumerate(lines, start=1):
                st.write(f"{idx}. {line}")

            action_perf = learning.get("recommendation_type_performance", pd.DataFrame())
            if isinstance(action_perf, pd.DataFrame) and not action_perf.empty:
                st.markdown("**Which Recommendation Types Worked**")
                display_cols = [
                    "action_type",
                    "total",
                    "won",
                    "win_rate",
                    "positive_rate",
                    "avg_priority",
                    "avg_churn",
                    "avg_credit",
                ]
                action_cols = [c for c in display_cols if c in action_perf.columns]
                st.dataframe(
                    action_perf[action_cols],
                    column_config={
                        "action_type": "Recommendation Type",
                        "win_rate": st.column_config.NumberColumn("Win Rate", format="%.2f"),
                        "positive_rate": st.column_config.NumberColumn("Positive Rate", format="%.2f"),
                        "avg_priority": st.column_config.NumberColumn("Avg Priority", format="%.2f"),
                        "avg_churn": st.column_config.NumberColumn("Avg Churn", format="%.3f"),
                        "avg_credit": st.column_config.NumberColumn("Avg Credit Risk", format="%.3f"),
                    },
                    use_container_width=True,
                    hide_index=True,
                )

            msg_perf = learning.get("messaging_style_performance", pd.DataFrame())
            if isinstance(msg_perf, pd.DataFrame) and not msg_perf.empty:
                st.markdown("**Which Messaging Style Converted Better**")
                msg_cols = [c for c in ["tone", "channel", "total", "won", "win_rate", "positive_rate"] if c in msg_perf.columns]
                st.dataframe(
                    msg_perf[msg_cols],
                    column_config={
                        "tone": "Tone",
                        "channel": "Channel",
                        "win_rate": st.column_config.NumberColumn("Win Rate", format="%.2f"),
                        "positive_rate": st.column_config.NumberColumn("Positive Rate", format="%.2f"),
                    },
                    use_container_width=True,
                    hide_index=True,
                )

            tuning = learning.get("scoring_tuning", []) or []
            if tuning:
                st.markdown("**What to Tune in Scoring**")
                for idx, item in enumerate(tuning, start=1):
                    st.write(f"{idx}. {item}")

            st.markdown("**Gemini Weekly Learning Summary**")
            if learning.get("genai_error"):
                st.warning(learning.get("genai_error"))
            if learning.get("genai"):
                st.write(learning.get("genai"))

    st.markdown("---")
    st.subheader("Gemini Copilot Output")
    if plan.get("genai_error"):
        st.warning(plan.get("genai_error"))
    if plan.get("genai"):
        st.write(plan.get("genai"))
