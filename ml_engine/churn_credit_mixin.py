import numpy as np
import pandas as pd
import importlib
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import RobustScaler
from .schemas import ChurnModelReport, CreditRiskReport

# Try importing LightGBM — fall back to LogisticRegression if unavailable.
_LGBMClassifier = None
_HAS_LGBM = False
try:
    _lgbm_mod = importlib.import_module("lightgbm")
    _LGBMClassifier = getattr(_lgbm_mod, "LGBMClassifier", None)
    _HAS_LGBM = _LGBMClassifier is not None
except Exception:
    _HAS_LGBM = False

# Try importing SHAP for explainability.
_shap = None
_HAS_SHAP = False
try:
    _shap = importlib.import_module("shap")
    _HAS_SHAP = True
except Exception:
    _HAS_SHAP = False


class ChurnCreditMixin:
    def _resolve_model_feature_names(self):
        # Prefer the exact feature order recorded at training time.
        report_features = self.churn_model_report.get("features_used", [])
        if isinstance(report_features, list) and report_features:
            return [str(f) for f in report_features]

        model = self.churn_model
        if model is not None:
            inner = model.estimator if hasattr(model, "estimator") else model
            if hasattr(inner, "feature_names_in_"):
                try:
                    names = [str(f) for f in list(inner.feature_names_in_)]
                    if names:
                        return names
                except Exception:
                    pass
            if hasattr(inner, "named_steps"):
                for step_name in ("scaler", "clf"):
                    step = inner.named_steps.get(step_name)
                    if step is not None and hasattr(step, "feature_names_in_"):
                        try:
                            names = [str(f) for f in list(step.feature_names_in_)]
                            if names:
                                return names
                        except Exception:
                            pass

        return [str(f) for f in self.churn_model_features]

    @staticmethod
    def _build_feature_frame(df, feature_names):
        frame = df.copy()
        for f in feature_names:
            if f not in frame.columns:
                frame[f] = 0.0
        return frame[feature_names].fillna(0.0).astype(float)

    def _build_churn_training_data(self):
        """
        Build temporal samples with EXPANDED feature set:
        - Original 7: recent/prev revenue+txns, recency, growth, revenue_drop
        - NEW behavioral: avg_order_value, avg_order_value_prev, category_count,
          category_count_prev, max_days_between_txns, payment_regularity
        Features from trailing windows at anchor_date and label from next horizon.
        """
        query = """
        WITH max_date_cte AS (
            SELECT MAX(date)::date AS last_recorded_date
            FROM transactions_dsr t
            WHERE {approved}
        ),
        anchors AS (
            SELECT GENERATE_SERIES(
                DATE_TRUNC('month', (SELECT last_recorded_date FROM max_date_cte) - INTERVAL '{history_months} months'),
                DATE_TRUNC('month', (SELECT last_recorded_date FROM max_date_cte) - INTERVAL '1 month'),
                INTERVAL '1 month'
            )::date AS anchor_date
        ),
        party_candidates AS (
            SELECT DISTINCT t.party_id
            FROM transactions_dsr t
            WHERE {approved}
        ),
        feature_windows AS (
            SELECT
                a.anchor_date,
                pc.party_id,
                -- Revenue features
                COALESCE(SUM(tp.net_amt) FILTER (
                    WHERE t.date >= a.anchor_date - INTERVAL '90 days'
                      AND t.date < a.anchor_date
                ), 0) AS recent_90_revenue,
                COALESCE(SUM(tp.net_amt) FILTER (
                    WHERE t.date >= a.anchor_date - INTERVAL '180 days'
                      AND t.date < a.anchor_date - INTERVAL '90 days'
                ), 0) AS prev_90_revenue,
                -- Transaction count features
                COUNT(DISTINCT t.id) FILTER (
                    WHERE t.date >= a.anchor_date - INTERVAL '90 days'
                      AND t.date < a.anchor_date
                ) AS recent_txns,
                COUNT(DISTINCT t.id) FILTER (
                    WHERE t.date >= a.anchor_date - INTERVAL '180 days'
                      AND t.date < a.anchor_date - INTERVAL '90 days'
                ) AS prev_txns,
                -- Recency
                MAX(t.date) FILTER (
                    WHERE t.date < a.anchor_date
                )::date AS last_purchase_date,
                -- Horizon (label)
                COALESCE(SUM(tp.net_amt) FILTER (
                    WHERE t.date >= a.anchor_date
                      AND t.date < a.anchor_date + INTERVAL '{horizon_days} days'
                ), 0) AS next_horizon_revenue,
                COUNT(DISTINCT t.id) FILTER (
                    WHERE t.date >= a.anchor_date
                      AND t.date < a.anchor_date + INTERVAL '{horizon_days} days'
                ) AS next_horizon_txns,
                -- NEW: Average order value (recent 90d)
                CASE WHEN COUNT(DISTINCT t.id) FILTER (
                    WHERE t.date >= a.anchor_date - INTERVAL '90 days'
                      AND t.date < a.anchor_date
                ) > 0
                THEN COALESCE(SUM(tp.net_amt) FILTER (
                    WHERE t.date >= a.anchor_date - INTERVAL '90 days'
                      AND t.date < a.anchor_date
                ), 0) * 1.0 / NULLIF(COUNT(DISTINCT t.id) FILTER (
                    WHERE t.date >= a.anchor_date - INTERVAL '90 days'
                      AND t.date < a.anchor_date
                ), 0)
                ELSE 0 END AS avg_order_value,
                -- NEW: Average order value (prev 90d)
                CASE WHEN COUNT(DISTINCT t.id) FILTER (
                    WHERE t.date >= a.anchor_date - INTERVAL '180 days'
                      AND t.date < a.anchor_date - INTERVAL '90 days'
                ) > 0
                THEN COALESCE(SUM(tp.net_amt) FILTER (
                    WHERE t.date >= a.anchor_date - INTERVAL '180 days'
                      AND t.date < a.anchor_date - INTERVAL '90 days'
                ), 0) * 1.0 / NULLIF(COUNT(DISTINCT t.id) FILTER (
                    WHERE t.date >= a.anchor_date - INTERVAL '180 days'
                      AND t.date < a.anchor_date - INTERVAL '90 days'
                ), 0)
                ELSE 0 END AS avg_order_value_prev,
                -- NEW: Category diversity (recent 90d)
                COUNT(DISTINCT p.group_id) FILTER (
                    WHERE t.date >= a.anchor_date - INTERVAL '90 days'
                      AND t.date < a.anchor_date
                ) AS category_count,
                -- NEW: Category diversity (prev 90d)
                COUNT(DISTINCT p.group_id) FILTER (
                    WHERE t.date >= a.anchor_date - INTERVAL '180 days'
                      AND t.date < a.anchor_date - INTERVAL '90 days'
                ) AS category_count_prev
            FROM anchors a
            CROSS JOIN party_candidates pc
            LEFT JOIN transactions_dsr t
              ON t.party_id = pc.party_id
             AND {approved}
             AND t.date < a.anchor_date + INTERVAL '{horizon_days} days'
            LEFT JOIN transactions_dsr_products tp
              ON t.id = tp.dsr_id
            LEFT JOIN master_products p
              ON tp.product_id = p.id
            GROUP BY a.anchor_date, pc.party_id
        )
        SELECT
            fw.anchor_date,
            mp.company_name,
            fw.recent_90_revenue,
            fw.prev_90_revenue,
            fw.recent_txns,
            fw.prev_txns,
            fw.last_purchase_date,
            fw.next_horizon_revenue,
            fw.next_horizon_txns,
            fw.avg_order_value,
            fw.avg_order_value_prev,
            fw.category_count,
            fw.category_count_prev
        FROM feature_windows fw
        JOIN master_party mp ON fw.party_id = mp.id
        """.format(
            approved=self._approved_condition("t"),
            history_months=int(self.churn_history_months),
            horizon_days=int(self.churn_horizon_days),
        )
        try:
            df = pd.read_sql(query, self.engine)
        except Exception:
            return pd.DataFrame()

        if df.empty:
            return df

        df["anchor_date"] = pd.to_datetime(df["anchor_date"], errors="coerce")
        df["last_purchase_date"] = pd.to_datetime(df["last_purchase_date"], errors="coerce")
        df["recency_days"] = (df["anchor_date"] - df["last_purchase_date"]).dt.days.fillna(9999)
        prev = df["prev_90_revenue"].replace(0, np.nan)
        df["growth_rate_90d"] = ((df["recent_90_revenue"] - df["prev_90_revenue"]) / prev).fillna(0.0)
        df["revenue_drop_pct"] = np.where(
            (df["prev_90_revenue"] > 0) & (df["recent_90_revenue"] < df["prev_90_revenue"]),
            ((df["prev_90_revenue"] - df["recent_90_revenue"]) / df["prev_90_revenue"]) * 100.0,
            0.0,
        )

        # --- Derived behavioral features ---
        # AOV trend: % change in average order value
        prev_aov = df["avg_order_value_prev"].replace(0, np.nan)
        df["aov_trend"] = ((df["avg_order_value"] - df["avg_order_value_prev"]) / prev_aov).fillna(0.0)
        df["aov_trend"] = df["aov_trend"].clip(-5.0, 5.0)

        # Category diversity change
        df["category_diversity_change"] = (
            df["category_count"].astype(float) - df["category_count_prev"].astype(float)
        )

        # Engagement velocity: txn frequency change ratio
        prev_txns_safe = df["prev_txns"].replace(0, np.nan)
        df["engagement_velocity"] = (df["recent_txns"] / prev_txns_safe).fillna(0.0)
        df["engagement_velocity"] = df["engagement_velocity"].clip(0.0, 10.0)

        # --- Churn label ---
        churn_by_silence = (df["next_horizon_txns"] == 0) & (df["recent_txns"] > 0)
        churn_by_revenue = (
            (df["recent_90_revenue"] > 0)
            & (df["next_horizon_revenue"] <= (0.4 * df["recent_90_revenue"]))
        )
        df["target_churn"] = (churn_by_silence | churn_by_revenue).astype(int)

        # --- Survival target: days until churn (for survival analysis) ---
        # Time-to-event: days from anchor to next purchase, or censored at horizon
        df["days_to_next_purchase"] = np.where(
            df["next_horizon_txns"] > 0,
            int(self.churn_horizon_days) // 2,  # Approximate midpoint for active
            int(self.churn_horizon_days),        # Full horizon for churned
        )
        df["event_observed"] = df["target_churn"]  # 1 = churned (event), 0 = censored

        # Keep only rows with meaningful historical context.
        df = df[(df["recent_90_revenue"] > 0) | (df["prev_90_revenue"] > 0)].copy()
        return df

    def _train_churn_model(self):
        """
        Train churn model using LightGBM (gradient boosting) with calibration.
        Falls back to LogisticRegression if LightGBM is unavailable.
        Also computes SHAP feature importances when available.
        """
        self.churn_model = None
        self.churn_model_report = {}
        self.churn_shap_explainer = None
        self.churn_feature_importance = None
        df = self.df_churn_training
        if df is None or df.empty:
            self.churn_model_report = ChurnModelReport(
                status="failed", reason="No churn training data."
            ).to_dict()
            return

        model_df = df.dropna(subset=["anchor_date"]).copy()
        if model_df.empty:
            self.churn_model_report = ChurnModelReport(
                status="failed", reason="No valid anchor dates."
            ).to_dict()
            return

        # Use expanded features (backwards compatible: missing cols → 0)
        available_features = [
            f for f in self.churn_model_features if f in model_df.columns
        ]
        if not available_features:
            self.churn_model_report = ChurnModelReport(
                status="failed", reason="No churn features available in training data."
            ).to_dict()
            return

        X = model_df[available_features].fillna(0.0).astype(float)
        y = model_df["target_churn"].astype(int)
        if y.nunique() < 2:
            self.churn_model_report = ChurnModelReport(
                status="failed",
                reason="Target has single class; cannot train classifier.",
            ).to_dict() | {"samples": int(len(model_df))}
            return

        # Temporal train/valid split
        anchors = sorted(model_df["anchor_date"].dropna().unique())
        if len(anchors) >= 5:
            split_anchor = anchors[-2]
            train_mask = model_df["anchor_date"] < split_anchor
            valid_mask = model_df["anchor_date"] >= split_anchor
        else:
            cutoff = int(len(model_df) * 0.8)
            order = model_df["anchor_date"].rank(method="first")
            train_mask = order <= cutoff
            valid_mask = ~train_mask

        X_train = X.loc[train_mask]
        y_train = y.loc[train_mask]
        X_valid = X.loc[valid_mask]
        y_valid = y.loc[valid_mask]
        if len(X_train) < 100 or y_train.nunique() < 2:
            self.churn_model_report = ChurnModelReport(
                status="failed",
                reason="Insufficient train samples after temporal split.",
                train_samples=int(len(X_train)),
            ).to_dict()
            return

        # --- Model selection: LightGBM > LogisticRegression ---
        if _HAS_LGBM:
            # Calculate scale_pos_weight for class imbalance
            n_neg = int((y_train == 0).sum())
            n_pos = int((y_train == 1).sum())
            spw = n_neg / max(n_pos, 1)

            base_model = Pipeline(
                steps=[
                    ("scaler", RobustScaler()),
                    (
                        "clf",
                            _LGBMClassifier(
                            n_estimators=300,
                            max_depth=6,
                            learning_rate=0.05,
                            min_child_samples=20,
                            subsample=0.8,
                            colsample_bytree=0.8,
                            scale_pos_weight=spw,
                            reg_alpha=0.1,
                            reg_lambda=1.0,
                            random_state=42,
                            verbose=-1,
                            n_jobs=-1,
                        ),
                    ),
                ]
            )
            model_type = "lightgbm"
        else:
            base_model = Pipeline(
                steps=[
                    ("scaler", RobustScaler()),
                    (
                        "clf",
                        LogisticRegression(
                            solver="liblinear",
                            max_iter=5000,
                            class_weight="balanced",
                        ),
                    ),
                ]
            )
            model_type = "logistic_regression"

        # Platt calibration when we have enough samples
        if y_train.value_counts().min() >= 10 and len(X_train) >= 300:
            model = CalibratedClassifierCV(base_model, cv=3, method="sigmoid")
        else:
            model = base_model

        model.fit(X_train, y_train)
        self.churn_model = model

        # --- Evaluate ---
        report = ChurnModelReport(
            status="ok",
            train_samples=int(len(X_train)),
            valid_samples=int(len(X_valid)),
            positive_rate_train=round(float(y_train.mean()), 4),
            positive_rate_valid=round(float(y_valid.mean()), 4) if len(y_valid) else None,
        ).to_dict()
        report["model_type"] = model_type
        report["features_used"] = available_features

        if len(X_valid) and y_valid.nunique() > 1:
            valid_proba = model.predict_proba(X_valid)[:, 1]
            report["roc_auc"] = round(float(roc_auc_score(y_valid, valid_proba)), 4)
            report["avg_precision"] = round(
                float(average_precision_score(y_valid, valid_proba)), 4
            )

        # --- SHAP explainability ---
        try:
            self._compute_shap_importance(model, X_train, available_features, report)
        except Exception:
            report["shap_status"] = "failed"

        self.churn_model_report = report

        # --- Survival analysis ---
        try:
            self._fit_survival_model(model_df, available_features)
        except Exception:
            pass

    def _compute_shap_importance(self, model, X_train, feature_names, report):
        """
        Compute SHAP-based feature importance for the churn model.
        Stores global feature importances and a SHAP explainer for per-partner use.
        """
        if not _HAS_SHAP:
            report["shap_status"] = "unavailable"
            return

        # Use a subsample for SHAP to keep it fast
        n_sample = min(500, len(X_train))
        X_sample = X_train.sample(n=n_sample, random_state=42) if len(X_train) > n_sample else X_train

        # Get the final estimator for SHAP
        if hasattr(model, "estimator"):  # CalibratedClassifierCV
            inner = model.estimator
        else:
            inner = model

        # Extract the actual classifier from pipeline
        if hasattr(inner, "named_steps"):
            scaler = inner.named_steps.get("scaler")
            clf = inner.named_steps.get("clf")
            if scaler is not None:
                X_scaled = pd.DataFrame(
                    scaler.transform(X_sample),
                    columns=feature_names,
                    index=X_sample.index,
                )
            else:
                X_scaled = X_sample
        else:
            clf = inner
            X_scaled = X_sample

        # Choose SHAP explainer based on model type
        if _HAS_LGBM and _LGBMClassifier is not None and isinstance(clf, _LGBMClassifier):
            explainer = _shap.TreeExplainer(clf)
        else:
            explainer = _shap.LinearExplainer(clf, X_scaled)

        shap_values = explainer.shap_values(X_scaled)
        # For binary classifiers, shap_values may be a list [class_0, class_1]
        if isinstance(shap_values, list) and len(shap_values) == 2:
            sv = shap_values[1]
        else:
            sv = shap_values

        # Global feature importance: mean |SHAP value|
        mean_abs_shap = np.abs(sv).mean(axis=0)
        importance_dict = dict(zip(feature_names, [round(float(v), 6) for v in mean_abs_shap]))
        sorted_importance = dict(
            sorted(importance_dict.items(), key=lambda x: x[1], reverse=True)
        )

        self.churn_feature_importance = sorted_importance
        self.churn_shap_explainer = explainer

        report["shap_status"] = "ok"
        report["feature_importance"] = sorted_importance
        report["top_churn_drivers"] = list(sorted_importance.keys())[:5]

    def explain_partner_churn(self, company_name):
        """
        Generate per-partner SHAP explanation for churn risk.
        Returns dict with feature contributions sorted by impact.
        """
        if (
            self.churn_shap_explainer is None
            or self.churn_model is None
            or self.df_partner_features is None
            or self.df_partner_features.empty
        ):
            return {"status": "unavailable", "reason": "SHAP explainer or model not available."}

        if company_name not in self.df_partner_features.index:
            return {"status": "not_found", "reason": f"Partner '{company_name}' not found."}

        model_features = self._resolve_model_feature_names()
        partner_data = self._build_feature_frame(
            self.df_partner_features.loc[[company_name]],
            model_features,
        )

        try:
            # Get the model's inner scaler
            model = self.churn_model
            if hasattr(model, "estimator"):
                inner = model.estimator
            else:
                inner = model
            if hasattr(inner, "named_steps"):
                scaler = inner.named_steps.get("scaler")
                if scaler is not None:
                    partner_scaled = pd.DataFrame(
                        scaler.transform(partner_data),
                        columns=model_features,
                        index=partner_data.index,
                    )
                else:
                    partner_scaled = partner_data
            else:
                partner_scaled = partner_data

            shap_values = self.churn_shap_explainer.shap_values(partner_scaled)
            if isinstance(shap_values, list) and len(shap_values) == 2:
                sv = shap_values[1][0]
            else:
                sv = shap_values[0] if len(shap_values.shape) > 1 else shap_values

            churn_prob = float(self.df_partner_features.loc[company_name, "churn_probability"])

            contributions = {}
            for feat, val in zip(model_features, sv):
                contributions[feat] = {
                    "shap_value": round(float(val), 4),
                    "feature_value": round(float(partner_data[feat].iloc[0]), 2),
                    "direction": "increases risk" if val > 0 else "decreases risk",
                }

            # Sort by absolute SHAP value
            sorted_contribs = dict(
                sorted(contributions.items(), key=lambda x: abs(x[1]["shap_value"]), reverse=True)
            )

            return {
                "status": "ok",
                "company_name": company_name,
                "churn_probability": round(churn_prob, 4),
                "churn_risk_band": str(self.df_partner_features.loc[company_name].get("churn_risk_band", "Unknown")),
                "feature_contributions": sorted_contribs,
                "top_risk_factors": [
                    f"{k}: {v['shap_value']:+.4f} ({v['direction']})"
                    for k, v in list(sorted_contribs.items())[:5]
                ],
            }
        except Exception as e:
            return {"status": "error", "reason": str(e)}

    def _fit_survival_model(self, training_df, feature_names):
        """
        Survival Analysis: Time-to-churn using Kaplan-Meier curves and
        Cox Proportional Hazards model for per-partner expected time-to-churn.
        """
        self.survival_model = None
        self.survival_report = {}

        CoxPHFitter = None
        KaplanMeierFitter = None
        try:
            _lifelines_mod = importlib.import_module("lifelines")
            CoxPHFitter = getattr(_lifelines_mod, "CoxPHFitter", None)
            KaplanMeierFitter = getattr(_lifelines_mod, "KaplanMeierFitter", None)
            _has_lifelines = CoxPHFitter is not None and KaplanMeierFitter is not None
        except Exception:
            _has_lifelines = False

        if not _has_lifelines:
            self.survival_report = {"status": "unavailable", "reason": "lifelines not installed"}
            return

        # Prepare survival data
        required = ["days_to_next_purchase", "event_observed"]
        if not all(c in training_df.columns for c in required):
            self.survival_report = {"status": "failed", "reason": "Missing survival columns."}
            return

        surv_df = training_df[feature_names + required].dropna().copy()
        surv_df = surv_df.replace([np.inf, -np.inf], np.nan).dropna()

        if len(surv_df) < 50:
            self.survival_report = {"status": "failed", "reason": "Insufficient survival data."}
            return

        # --- Kaplan-Meier: Overall survival curve ---
        kmf = KaplanMeierFitter()
        kmf.fit(
            durations=surv_df["days_to_next_purchase"],
            event_observed=surv_df["event_observed"],
        )
        median_survival = float(kmf.median_survival_time_) if np.isfinite(kmf.median_survival_time_) else None
        survival_at_30 = float(kmf.predict(30)) if 30 <= surv_df["days_to_next_purchase"].max() else None
        survival_at_60 = float(kmf.predict(60)) if 60 <= surv_df["days_to_next_purchase"].max() else None
        survival_at_90 = float(kmf.predict(90)) if 90 <= surv_df["days_to_next_purchase"].max() else None

        # --- Cox PH: Feature-level hazard ratios ---
        cox = CoxPHFitter(penalizer=0.1)
        try:
            cox.fit(
                surv_df,
                duration_col="days_to_next_purchase",
                event_col="event_observed",
            )
            self.survival_model = cox

            # Hazard ratios: exp(coef) > 1 → increases churn hazard
            hazard_ratios = {}
            for feat in feature_names:
                if feat in cox.summary.index:
                    hr = float(np.exp(cox.summary.loc[feat, "coef"]))
                    p_val = float(cox.summary.loc[feat, "p"])
                    hazard_ratios[feat] = {
                        "hazard_ratio": round(hr, 4),
                        "p_value": round(p_val, 4),
                        "significant": p_val < 0.05,
                        "interpretation": (
                            f"{'Increases' if hr > 1 else 'Decreases'} churn risk by "
                            f"{abs(hr - 1) * 100:.1f}% per unit"
                        ),
                    }
            # Sort by hazard ratio (highest risk first)
            hazard_ratios = dict(
                sorted(hazard_ratios.items(), key=lambda x: x[1]["hazard_ratio"], reverse=True)
            )

            concordance = round(float(cox.concordance_index_), 4)
        except Exception:
            hazard_ratios = {}
            concordance = None

        self.survival_report = {
            "status": "ok",
            "median_survival_days": median_survival,
            "survival_probability": {
                "30_days": round(survival_at_30, 4) if survival_at_30 is not None else None,
                "60_days": round(survival_at_60, 4) if survival_at_60 is not None else None,
                "90_days": round(survival_at_90, 4) if survival_at_90 is not None else None,
            },
            "concordance_index": concordance,
            "hazard_ratios": hazard_ratios,
            "samples": int(len(surv_df)),
        }

    def predict_partner_survival(self, company_name):
        """
        Predict time-to-churn for a specific partner using the Cox PH model.
        Returns expected survival curve and predicted median time-to-churn.
        """
        if self.survival_model is None:
            return {"status": "unavailable", "reason": "Survival model not fitted."}

        if self.df_partner_features is None or self.df_partner_features.empty:
            return {"status": "unavailable", "reason": "No partner features."}

        if company_name not in self.df_partner_features.index:
            return {"status": "not_found", "reason": f"Partner '{company_name}' not found."}

        model_features = self._resolve_model_feature_names()
        partner_data = self._build_feature_frame(
            self.df_partner_features.loc[[company_name]],
            model_features,
        )

        try:
            surv_func = self.survival_model.predict_survival_function(partner_data)
            median_time = self.survival_model.predict_median(partner_data)

            # Survival probabilities at key timepoints
            predictions = {
                "company_name": company_name,
                "status": "ok",
                "predicted_median_days_to_churn": (
                    round(float(median_time.values[0]), 1)
                    if np.isfinite(median_time.values[0])
                    else None
                ),
                "survival_probabilities": {},
                "risk_assessment": "",
            }

            for days in [30, 60, 90, 180]:
                if days in surv_func.index:
                    prob = float(surv_func.loc[days].values[0])
                    predictions["survival_probabilities"][f"{days}_days"] = round(prob, 4)

            # Risk assessment
            med = predictions["predicted_median_days_to_churn"]
            if med is not None:
                if med < 30:
                    predictions["risk_assessment"] = "CRITICAL — likely to churn within 30 days"
                elif med < 60:
                    predictions["risk_assessment"] = "HIGH — likely to churn within 60 days"
                elif med < 90:
                    predictions["risk_assessment"] = "MODERATE — may churn within a quarter"
                else:
                    predictions["risk_assessment"] = "LOW — expected to remain active for 90+ days"

            return predictions
        except Exception as e:
            return {"status": "error", "reason": str(e)}

    def _score_partner_churn_risk(self):
        if self.df_partner_features is None or self.df_partner_features.empty:
            return

        model_features = self._resolve_model_feature_names()
        features = self._build_feature_frame(self.df_partner_features, model_features)
        if self.churn_model is not None:
            churn_prob = self.churn_model.predict_proba(features)[:, 1]
        else:
            # Fallback heuristic if model is unavailable.
            churn_prob = (
                0.45 * self._normalize(self.df_partner_features["revenue_drop_pct"]).values
                + 0.35 * self._normalize(self.df_partner_features["recency_days"]).values
                + 0.20 * (1.0 - self._normalize(self.df_partner_features["recent_txns"]).values)
            )
        churn_prob = np.clip(churn_prob, 0.0, 1.0)
        self.df_partner_features["churn_probability"] = churn_prob
        self.df_partner_features["expected_revenue_at_risk_90d"] = (
            self.df_partner_features["recent_90_revenue"].fillna(0.0) * churn_prob
        )
        self.df_partner_features["expected_revenue_at_risk_monthly"] = (
            self.df_partner_features["expected_revenue_at_risk_90d"] / 3.0
        )
        self.df_partner_features["churn_risk_band"] = np.where(
            churn_prob >= self.churn_prob_high,
            "High",
            np.where(churn_prob >= self.churn_prob_medium, "Medium", "Low"),
        )

    def _build_partner_forecast(self):
        if self.df_monthly_revenue is None or self.df_monthly_revenue.empty:
            self.df_forecast = pd.DataFrame()
            return

        rows = []
        for company_name, grp in self.df_monthly_revenue.groupby("company_name"):
            g = grp.sort_values("sale_month").tail(self.forecast_history_months)
            vals = g["monthly_revenue"].astype(float).values
            if len(vals) == 0:
                continue

            # Weighted moving average baseline with slight trend adjustment.
            if len(vals) >= 3:
                weights = np.array([0.5, 0.3, 0.2][: len(vals)][::-1], dtype=float)
                weights = weights / weights.sum()
                recent_vals = vals[-len(weights) :]
                base = float(np.dot(recent_vals, weights))
                x = np.arange(len(vals), dtype=float)
                slope = float(np.polyfit(x, vals, 1)[0]) if len(vals) >= 3 else 0.0
                forecast = max(0.0, base + slope)
            elif len(vals) == 2:
                forecast = max(0.0, float(0.7 * vals[-1] + 0.3 * vals[-2]))
                slope = float(vals[-1] - vals[-2])
            else:
                forecast = max(0.0, float(vals[-1]))
                slope = 0.0

            mean_val = float(np.mean(vals)) if float(np.mean(vals)) > 0 else 1.0
            vol = float(np.std(vals) / mean_val)
            confidence = float(np.clip(1.0 / (1.0 + vol), 0.2, 0.95))
            trend_pct = float((slope / mean_val) * 100.0) if mean_val > 0 else 0.0

            rows.append(
                {
                    "company_name": company_name,
                    "forecast_next_30d": forecast,
                    "forecast_trend_pct": trend_pct,
                    "forecast_confidence": confidence,
                    "forecast_history_months": int(len(vals)),
                }
            )

        self.df_forecast = pd.DataFrame(rows)
        if self.df_forecast.empty:
            return
        self.df_forecast = self.df_forecast.set_index("company_name")
        if self.df_partner_features is not None and not self.df_partner_features.empty:
            forecast_cols = list(self.df_forecast.columns)
            overlap = [c for c in forecast_cols if c in self.df_partner_features.columns]
            if overlap:
                # Idempotent refresh: replace stale forecast columns on each recompute.
                self.df_partner_features = self.df_partner_features.drop(columns=overlap)
            self.df_partner_features = self.df_partner_features.join(
                self.df_forecast[forecast_cols], how="left"
            )

    def _load_credit_risk_features(self):
        """
        Build partner-level credit/payment behavior summary.
        Uses due_payment + due_payment_amount and optional credit limits.
        """
        query = """
        WITH bills AS (
            SELECT
                dp.id AS due_payment_id,
                mp.company_name,
                dp.bill_date::date AS bill_date,
                COALESCE(dp.credit_days, 0) AS credit_days,
                COALESCE(dp.net_amt, dp.amount, 0) AS bill_amount,
                COALESCE(
                    dp.payment_date::date,
                    MAX(dpa.collection_date)::date
                ) AS settled_date
            FROM due_payment dp
            LEFT JOIN due_payment_amount dpa
              ON dpa.due_payment_id = dp.id
             AND LOWER(CAST(dpa.is_approved AS TEXT)) = 'true'
            LEFT JOIN transactions_dsr t
              ON dp.dsr_id = t.id
            LEFT JOIN master_party mp
              ON t.party_id = mp.id
            WHERE mp.company_name IS NOT NULL
            GROUP BY
                dp.id,
                mp.company_name,
                dp.bill_date,
                dp.credit_days,
                dp.net_amt,
                dp.amount,
                dp.payment_date
        ),
        ref_date AS (
            SELECT MAX(COALESCE(settled_date, bill_date))::date AS as_of_date
            FROM bills
        ),
        agg AS (
            SELECT
                b.company_name,
                COUNT(*) AS total_bills,
                COALESCE(SUM(b.bill_amount), 0) AS total_billed_amount,
                COALESCE(SUM(CASE WHEN b.settled_date IS NULL THEN b.bill_amount ELSE 0 END), 0) AS outstanding_amount,
                COALESCE(AVG(
                    GREATEST(
                        (COALESCE(b.settled_date, (SELECT as_of_date FROM ref_date))
                         - (b.bill_date + (b.credit_days || ' days')::interval)::date),
                        0
                    )
                ), 0) AS avg_delay_days,
                COALESCE(
                    PERCENTILE_CONT(0.9) WITHIN GROUP (
                        ORDER BY GREATEST(
                            (COALESCE(b.settled_date, (SELECT as_of_date FROM ref_date))
                             - (b.bill_date + (b.credit_days || ' days')::interval)::date),
                            0
                        )
                    ),
                    0
                ) AS p90_delay_days
            FROM bills b
            GROUP BY b.company_name
        ),
        credit AS (
            SELECT
                mp.company_name,
                MAX(COALESCE(mpcd.credit_limit, 0)) AS credit_limit
            FROM master_party_credit_details mpcd
            JOIN master_party mp ON mpcd.party_id = mp.id
            GROUP BY mp.company_name
        )
        SELECT
            a.company_name,
            a.total_bills,
            a.total_billed_amount,
            a.outstanding_amount,
            a.avg_delay_days,
            a.p90_delay_days,
            COALESCE(c.credit_limit, 0) AS credit_limit,
            CASE
                WHEN a.total_billed_amount > 0
                THEN a.outstanding_amount / a.total_billed_amount
                ELSE 0
            END AS overdue_ratio,
            CASE
                WHEN COALESCE(c.credit_limit, 0) > 0
                THEN a.outstanding_amount / c.credit_limit
                ELSE 0
            END AS credit_utilization
        FROM agg a
        LEFT JOIN credit c ON a.company_name = c.company_name
        """
        try:
            df = pd.read_sql(query, self.engine)
            if df.empty:
                return df
            return df.set_index("company_name")
        except Exception:
            return pd.DataFrame()

    def _score_credit_risk(self):
        self.credit_risk_report = {}
        if self.df_partner_features is None or self.df_partner_features.empty:
            self.credit_risk_report = CreditRiskReport(
                status="failed", reason="No partner feature frame."
            ).to_dict()
            return

        if self.df_credit_risk is None or self.df_credit_risk.empty:
            # Safe defaults when payment tables are not available.
            self.df_partner_features["credit_risk_score"] = 0.0
            self.df_partner_features["credit_risk_band"] = "Unknown"
            self.df_partner_features["outstanding_amount"] = 0.0
            self.df_partner_features["credit_utilization"] = 0.0
            self.df_partner_features["overdue_ratio"] = 0.0
            self.credit_risk_report = CreditRiskReport(
                status="failed", reason="Credit tables unavailable/empty."
            ).to_dict()
            return

        credit_cols = list(self.df_credit_risk.columns)
        overlap = [c for c in credit_cols if c in self.df_partner_features.columns]
        if overlap:
            # Idempotent refresh: drop stale credit columns before re-join.
            base_features = self.df_partner_features.drop(columns=overlap)
        else:
            base_features = self.df_partner_features
        merged = base_features.join(self.df_credit_risk[credit_cols], how="left")
        for col in ["avg_delay_days", "p90_delay_days", "credit_utilization", "overdue_ratio", "outstanding_amount"]:
            if col not in merged.columns:
                merged[col] = 0.0
            merged[col] = merged[col].fillna(0.0).astype(float)

        delay_score = self._normalize(merged["avg_delay_days"])
        p90_score = self._normalize(merged["p90_delay_days"])
        util_score = self._normalize(merged["credit_utilization"].clip(lower=0, upper=2.5))
        overdue_score = self._normalize(merged["overdue_ratio"].clip(lower=0, upper=1.0))

        merged["credit_risk_score"] = (
            0.35 * delay_score
            + 0.15 * p90_score
            + 0.25 * util_score
            + 0.25 * overdue_score
        ).clip(0.0, 1.0)
        merged["credit_risk_band"] = np.where(
            merged["credit_risk_score"] >= self.credit_risk_high,
            "High",
            np.where(merged["credit_risk_score"] >= self.credit_risk_medium, "Medium", "Low"),
        )

        # Credit-adjusted risk capture for prioritization.
        if "expected_revenue_at_risk_monthly" not in merged.columns:
            merged["expected_revenue_at_risk_monthly"] = 0.0
        merged["credit_adjusted_risk_value"] = (
            merged["expected_revenue_at_risk_monthly"].fillna(0.0)
            * (0.5 + 0.5 * merged["credit_risk_score"])
        )

        self.df_partner_features = merged
        self.credit_risk_report = CreditRiskReport(
            status="ok",
            covered_partners=int(merged["credit_risk_score"].notna().sum()),
            high_risk_partners=int((merged["credit_risk_band"] == "High").sum()),
            avg_credit_risk_score=round(float(merged["credit_risk_score"].mean()), 4),
        ).to_dict()
