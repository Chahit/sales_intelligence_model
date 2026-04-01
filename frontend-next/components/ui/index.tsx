"use client";
import React from "react";

/* ── Nexus Precision Design Tokens ────────────────────────── */
export const DS = {
  surface:    "#f7f9fb",
  surfaceLow: "#f2f4f6",
  card:       "#ffffff",
  surfaceHigh:"#e6e8ea",
  surfaceTop: "#e0e3e5",

  text:       "#191c1e",
  textMuted:  "#464555",
  outline:    "#777587",
  outlineVar: "#c7c4d8",

  primary:    "#4F46E5",
  primaryDp:  "#3525cd",
  primaryFix: "#e2dfff",
  sidebar:    "#181445",

  green:      "#059669",
  greenBg:    "#ECFDF5",
  amber:      "#B45309",
  amberBg:    "#FFFBEB",
  red:        "#DC2626",
  redBg:      "#FEF2F2",
  blue:       "#2563EB",
  blueBg:     "#EFF6FF",

  shadow:     "0 2px 12px rgba(25,28,30,0.05), 0 1px 3px rgba(25,28,30,0.04)",
  shadowUp:   "0 8px 24px rgba(79,70,229,0.08)",

  // Compat aliases
  onSurf:     "#191c1e",
  onSurVar:   "#464555",
  cardEl:     "#f2f4f6",
  cardDeep:   "#e6e8ea",
  outline2:   "#c7c4d8",
  redSoft:    "#FEF2F2",
  amberSoft:  "#FFFBEB",
  greenSoft:  "#ECFDF5",
  blueSoft:   "#EFF6FF",
  primarySoft:"#e2dfff",
};

/* ── PageHeader ─────────────────────────────────────────────*/
interface PageHeaderProps {
  title: string;
  description: string;
  badge?: string;
  badgeColor?: string;
  actions?: React.ReactNode;
}
export function PageHeader({ title, description, badge, badgeColor = "#4F46E5", actions }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontFamily: "'Manrope',sans-serif", fontSize: "1.75rem", fontWeight: 800, color: DS.text, letterSpacing: "-0.025em", lineHeight: 1.1 }}>{title}</h1>
          {badge && (
            <span style={{
              display: "inline-flex", alignItems: "center", padding: "3px 10px",
              borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
              background: `${badgeColor}18`, color: badgeColor,
              border: `1px solid ${badgeColor}28`, textTransform: "uppercase",
            }}>{badge}</span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 13.5, color: DS.textMuted, lineHeight: 1.5 }}>{description}</p>
      </div>
      {actions && <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

/* ── SectionLabel ───────────────────────────────────────────*/
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 8, margin: "1.5rem 0 0.875rem" }}>
      <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: DS.textMuted, whiteSpace: "nowrap" }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: "rgba(199,196,216,0.3)" }} />
    </div>
  );
}
// alias
export const SectionHeader = ({ title }: { title: string; subtitle?: string }) => <SectionLabel>{title}</SectionLabel>;

/* ── Panel ───────────────────────────────────────────────── */
export function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="panel" style={{ background: DS.card, borderRadius: 12, boxShadow: DS.shadow, overflow: "hidden", marginBottom: 16, ...style }}>{children}</div>;
}

/* ── PanelHeader ─────────────────────────────────────────── */
export function PanelHeader({ title, subtitle, sub, right }: { title: string; subtitle?: string; sub?: string; right?: React.ReactNode }) {
  const subText = subtitle ?? sub;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid rgba(199,196,216,0.15)" }}>
      <div>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: DS.text }}>{title}</p>
        {subText && <p style={{ margin: "2px 0 0", fontSize: 11, color: DS.textMuted }}>{subText}</p>}
      </div>
      {right}
    </div>
  );
}

/* ── MetricCard ─────────────────────────────────────────────*/
interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  color?: string;
  soft?: string;
}
export function MetricCard({ label, value, sub, trend, icon, color, soft }: MetricCardProps) {
  const trendColor = trend === "up" ? DS.green : trend === "down" ? DS.red : DS.textMuted;
  return (
    <div className="metric-card" style={{ background: soft || DS.card, borderRadius: 12, padding: "1.25rem 1.375rem", boxShadow: DS.shadow, transition: "box-shadow 0.18s, transform 0.18s" }}
      onMouseEnter={e => { const el = e.currentTarget; el.style.boxShadow = DS.shadowUp; el.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { const el = e.currentTarget; el.style.boxShadow = DS.shadow; el.style.transform = "none"; }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <p className="kpi-label" style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.textMuted, margin: 0 }}>{label}</p>
        {icon && <div style={{ padding: 7, borderRadius: 8, background: color ? `${color}15` : DS.surfaceLow, color: color || DS.primary, display: "flex" }}>{icon}</div>}
      </div>
      <p className="kpi-val" style={{ fontFamily: "'Manrope',sans-serif", fontSize: "1.875rem", fontWeight: 800, color: color || DS.text, letterSpacing: "-0.03em", lineHeight: 1.1, marginTop: "0.5rem" }}>{value}</p>
      {sub && <p style={{ margin: "4px 0 0", fontSize: 11, color: trendColor }}>{sub}</p>}
    </div>
  );
}

/* ── GaugeBar ────────────────────────────────────────────── */
export function GaugeBar({ pct, color }: { pct: number; color?: string }) {
  return (
    <div style={{ height: 6, background: DS.surfaceTop, borderRadius: 999, overflow: "hidden", marginTop: 8 }}>
      <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: color || DS.primary, borderRadius: 999, transition: "width 0.4s ease" }} />
    </div>
  );
}

/* ── LoadingSkeleton ─────────────────────────────────────── */
export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ padding: "24px 20px" }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton" style={{
          height: 18, borderRadius: 6, marginBottom: 12, width: `${90 - i * 8}%`,
          background: `linear-gradient(90deg, ${DS.surfaceHigh} 25%, ${DS.surfaceTop} 50%, ${DS.surfaceHigh} 75%)`,
          backgroundSize: "800px 100%",
          animation: "shimmer 1.4s ease-in-out infinite",
        }} />
      ))}
    </div>
  );
}

/* ── ErrorBanner ─────────────────────────────────────────── */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: DS.redBg, border: `1px solid ${DS.red}22`, borderRadius: 10, marginBottom: 16 }}>
      <span style={{ color: DS.red, fontSize: 14, fontWeight: 700 }}>⚠</span>
      <p style={{ margin: 0, color: DS.red, fontSize: 13, fontWeight: 600 }}>{message}</p>
    </div>
  );
}

/* ── EmptyState ─────────────────────────────────────────── */
export function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: DS.surfaceLow, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 20 }}>📋</div>
      <p style={{ margin: 0, fontSize: 14, color: DS.textMuted }}>{message}</p>
    </div>
  );
}

/* ── Btn ─────────────────────────────────────────────────── */
interface BtnProps { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "outline" | "ghost"; size?: "sm" | "md"; style?: React.CSSProperties; }
export function Btn({ children, onClick, variant = "primary", size = "md", style }: BtnProps) {
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
    fontWeight: 600, fontSize: size === "sm" ? 11.5 : 13, borderRadius: 10,
    padding: size === "sm" ? "5px 12px" : "8px 16px", transition: "all 0.15s", border: "none",
  };
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: `linear-gradient(135deg, #3525cd, #4F46E5)`, color: "#fff", boxShadow: "0 2px 8px rgba(79,70,229,0.25)" },
    outline: { background: "transparent", color: DS.primary, border: `1px solid rgba(79,70,229,0.3)` },
    ghost:   { background: DS.surfaceHigh, color: DS.text },
  };
  return (
    <button onClick={onClick} style={{ ...base, ...styles[variant], ...style }}
      onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
      onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
      {children}
    </button>
  );
}
