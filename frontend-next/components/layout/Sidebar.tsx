"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users, Brain, Box, TrendingUp,
  Lightbulb, UserCheck, ShoppingCart, GitBranch,
  Activity, Bot, ChevronRight
} from "lucide-react";

const MODULES = [
  { href: "/partner-360",         label: "Partner 360",     sub: "Intelligence",        icon: Users,        accent: "#34D399", category: "core" },
  { href: "/cluster-intelligence",label: "Cluster Intel",   sub: "AI segments",         icon: Brain,        accent: "#818CF8", category: "core" },
  { href: "/product-lifecycle",   label: "Product Lifecycle",sub: "Velocity & EOL",     icon: TrendingUp,   accent: "#F472B6", category: "core" },
  { href: "/inventory",           label: "Inventory",       sub: "Dead stock",          icon: Box,          accent: "#60A5FA", category: "core" },
  { href: "/market-basket",       label: "Market Basket",   sub: "Cross-sell rules",    icon: ShoppingCart, accent: "#FB923C", category: "core" },
  { href: "/recommendation-hub",  label: "Recommendations", sub: "AI action plans",     icon: Lightbulb,    accent: "#FCD34D", category: "action" },
  { href: "/sales-rep",           label: "Sales Rep",       sub: "Rep performance",     icon: UserCheck,    accent: "#34D399", category: "action" },
  { href: "/pipeline",            label: "Pipeline",        sub: "Health kanban",       icon: GitBranch,    accent: "#38BDF8", category: "action" },
  { href: "/monitoring",          label: "Monitoring",      sub: "System health",       icon: Activity,     accent: "#4ADE80", category: "ops" },
  { href: "/chat",                label: "AI Chat",         sub: "Ask anything",        icon: Bot,          accent: "#a78bfa", category: "ops" },
];

const CATEGORIES = [
  { key: "core",   label: "INTELLIGENCE" },
  { key: "action", label: "ACTION" },
  { key: "ops",    label: "OPERATIONS" },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside style={{
      width: 256, minWidth: 256,
      background: "linear-gradient(180deg, #0f0c35 0%, #181445 40%, #1a1650 100%)",
      display: "flex", flexDirection: "column", height: "100vh",
      overflow: "hidden", userSelect: "none",
      borderRight: "1px solid rgba(255,255,255,0.04)",
    }}>
      {/* Logo */}
      <div style={{ padding: "22px 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: "linear-gradient(135deg, #3525cd 0%, #6366f1 50%, #818CF8 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Manrope', sans-serif", fontWeight: 900, fontSize: 15, color: "#fff",
            boxShadow: "0 4px 20px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.15)",
          }}>AI</div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#fff", fontFamily: "'Manrope',sans-serif", letterSpacing: "-0.015em" }}>Consistent AI</p>
            <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: "#6366f1", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 1 }}>SALES INTELLIGENCE</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "8px 10px 8px", scrollbarWidth: "none" }}>
        {CATEGORIES.map(cat => {
          const catModules = MODULES.filter(m => m.category === cat.key);
          return (
            <div key={cat.key}>
              <p style={{ margin: "14px 8px 6px", fontSize: 8.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#2d2a5a" }}>{cat.label}</p>
              {catModules.map(({ href, label, sub, icon: Icon, accent }) => {
                const active = path === href || path.startsWith(href + "/");
                return (
                  <Link key={href} href={href} style={{ textDecoration: "none", display: "block" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 10px", borderRadius: 10, marginBottom: 2,
                      background: active
                        ? `linear-gradient(135deg, ${accent}22 0%, ${accent}11 100%)`
                        : "transparent",
                      borderLeft: active ? `3px solid ${accent}` : "3px solid transparent",
                      transition: "all 0.15s ease",
                      cursor: "pointer",
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                        e.currentTarget.style.borderLeftColor = `${accent}55`;
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.borderLeftColor = "transparent";
                      }
                    }}>
                      {/* Icon */}
                      <div style={{
                        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: active ? `${accent}28` : "rgba(255,255,255,0.04)",
                        boxShadow: active ? `0 0 0 1px ${accent}33` : "none",
                        transition: "all 0.15s",
                      }}>
                        <Icon size={14} color={active ? accent : "#5a5880"} strokeWidth={active ? 2.5 : 1.8} />
                      </div>
                      {/* Text */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 12.5, fontWeight: active ? 700 : 500, color: active ? "#fff" : "#7c7a9c", lineHeight: 1.2, whiteSpace: "nowrap", letterSpacing: active ? "-0.005em" : "0" }}>{label}</p>
                        <p style={{ margin: 0, fontSize: 9.5, color: active ? accent : "#33304f", lineHeight: 1, fontWeight: 500 }}>{sub}</p>
                      </div>
                      {active && <ChevronRight size={10} color={accent} style={{ flexShrink: 0 }} />}
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Status footer */}
      <div style={{ padding: "10px 16px 14px", borderTop: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34D399", boxShadow: "0 0 8px #34D399, 0 0 16px #34D39944", animation: "pulseGlow 2s ease-in-out infinite" }} />
            <p style={{ margin: 0, fontSize: 11, color: "#34D399", fontWeight: 700 }}>ML Engine Active</p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ fontSize: 9, color: "#33304f", background: "rgba(255,255,255,0.04)", padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>FastAPI v2.0</span>
            <span style={{ fontSize: 9, color: "#33304f", background: "rgba(255,255,255,0.04)", padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>Next.js 15</span>
            <span style={{ fontSize: 9, color: "#33304f", background: "rgba(255,255,255,0.04)", padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>GPT-4o</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
