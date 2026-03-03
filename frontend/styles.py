"""
Shared UI utilities for the Consistent AI Dashboard.
Import and call apply_global_styles() at the top of each tab's render().
"""

import streamlit as st


# ── Global stylesheet ────────────────────────────────────────────────────────
GLOBAL_CSS = """
<style>
/* ── Page & sidebar ─────────────────────────────── */
[data-testid="stSidebar"] { min-width: 290px; }

/* ── Section card ───────────────────────────────── */
.ui-section {
    border: 1px solid #2a2a2a;
    border-radius: 8px;
    padding: 16px 20px 10px 20px;
    margin-bottom: 18px;
    background: #111111;
}
.ui-section-title {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #888;
    margin-bottom: 12px;
}

/* ── Status badges ───────────────────────────────── */
.badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.03em;
}
.badge-green  { background: #0d2b1a; color: #34d96f; border: 1px solid #1a5c35; }
.badge-amber  { background: #2b2200; color: #f5c842; border: 1px solid #5a4700; }
.badge-red    { background: #2b0a0a; color: #f55c5c; border: 1px solid #5c1a1a; }
.badge-blue   { background: #0a1a2b; color: #5cbcf5; border: 1px solid #1a3d5c; }
.badge-grey   { background: #1e1e1e; color: #aaa;    border: 1px solid #333; }

/* ── Page header ─────────────────────────────────── */
.page-header-cap {
    color: #888;
    font-size: 14px;
    margin-top: -10px;
    margin-bottom: 18px;
}

/* ── Divider label ───────────────────────────────── */
.divider-label {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 22px 0 14px 0;
    color: #666;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
}
.divider-label::before, .divider-label::after {
    content: "";
    flex: 1;
    border-bottom: 1px solid #2a2a2a;
}

/* ── Info banner ─────────────────────────────────── */
.info-banner {
    padding: 10px 16px;
    border-radius: 6px;
    margin-bottom: 14px;
    font-size: 14px;
    font-weight: 500;
}
.info-banner-green { background: #0d2b1a; border-left: 4px solid #34d96f; color: #d4f5e0; }
.info-banner-amber { background: #2b2200; border-left: 4px solid #f5c842; color: #f5e8a0; }
.info-banner-red   { background: #2b0a0a; border-left: 4px solid #f55c5c; color: #f5c0c0; }
.info-banner-blue  { background: #0a1a2b; border-left: 4px solid #5cbcf5; color: #b8ddf7; }

/* ── Chat bubbles (sidebar) ──────────────────────── */
.chat-message-user {
    background: #1e3a5f;
    color: #e8f4fd;
    padding: 10px 14px;
    border-radius: 12px 12px 2px 12px;
    margin: 6px 0;
    font-size: 13px;
}
.chat-message-ai {
    background: #1a2a1a;
    color: #d4f0d4;
    padding: 10px 14px;
    border-radius: 12px 12px 12px 2px;
    margin: 6px 0;
    border-left: 3px solid #2ecc71;
    font-size: 13px;
}

/* ── Compact dataframe ───────────────────────────── */
[data-testid="stDataFrame"] { border-radius: 6px; overflow: hidden; }
</style>
"""


def apply_global_styles():
    """Inject the global stylesheet. Call once at the top of every tab's render()."""
    st.markdown(GLOBAL_CSS, unsafe_allow_html=True)


# ── Helper: section header (uppercase label + thin line) ─────────────────────
def section_header(label: str):
    st.markdown(
        f'<div class="divider-label">{label}</div>',
        unsafe_allow_html=True,
    )


# ── Helper: status badge ──────────────────────────────────────────────────────
def status_badge(label: str, color: str = "grey") -> str:
    """Return an HTML badge string. color: green | amber | red | blue | grey"""
    return f'<span class="badge badge-{color}">{label}</span>'


# ── Helper: banner (info block with left border) ──────────────────────────────
def banner(message: str, color: str = "blue"):
    """Render a colored info banner. color: green | amber | red | blue"""
    st.markdown(
        f'<div class="info-banner info-banner-{color}">{message}</div>',
        unsafe_allow_html=True,
    )


# ── Helper: page description caption ─────────────────────────────────────────
def page_caption(text: str):
    st.markdown(f'<p class="page-header-cap">{text}</p>', unsafe_allow_html=True)


# ── Color helpers used in tables ──────────────────────────────────────────────
def health_color(status: str) -> str:
    s = str(status).lower()
    if "healthy" in s or "green" in s or "low" in s:
        return "green"
    if "watch" in s or "medium" in s or "amber" in s:
        return "amber"
    return "red"


def churn_color(prob: float) -> str:
    if prob < 0.35:
        return "green"
    if prob < 0.65:
        return "amber"
    return "red"


def price_diff_color(diff_pct: float) -> str:
    """Used for competitor price diff: positive = we're more expensive (bad)."""
    if diff_pct <= -5:
        return "green"   # we're cheaper
    if diff_pct >= 5:
        return "red"     # we're more expensive / undercut
    return "grey"
