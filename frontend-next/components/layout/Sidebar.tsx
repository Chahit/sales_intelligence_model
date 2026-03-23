"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Brain, Package, TrendingUp,
  Lightbulb, UserCheck, ShoppingCart, Kanban, Cpu,
} from "lucide-react";

const NAV = [
  { href: "/",                     icon: LayoutDashboard, label: "Home",             desc: "Executive overview" },
  { href: "/partner-360",          icon: Users,            label: "Partner 360",      desc: "Deep-dive on any partner" },
  { href: "/cluster-intelligence", icon: Brain,            label: "Cluster Intel",    desc: "AI partner segments" },
  { href: "/inventory",            icon: Package,          label: "Inventory",        desc: "Dead stock liquidation" },
  { href: "/product-lifecycle",    icon: TrendingUp,       label: "Product Lifecycle",desc: "Velocity & EOL signals" },
  { href: "/recommendation-hub",   icon: Lightbulb,        label: "Recommendations",  desc: "AI action playbooks" },
  { href: "/sales-rep",            icon: UserCheck,        label: "Sales Rep",        desc: "Rep performance" },
  { href: "/market-basket",        icon: ShoppingCart,     label: "Market Basket",    desc: "Cross-sell rules" },
  { href: "/pipeline",             icon: Kanban,           label: "Pipeline Tracker", desc: "Partner health board" },
  { href: "/monitoring",           icon: Cpu,              label: "Monitoring",       desc: "System & model health" },
];

export function Sidebar() {
  const path = usePathname();

  return (
    <aside className="flex flex-col w-64 min-w-[256px] h-screen bg-[#0d0d14] border-r border-white/[0.06] overflow-y-auto">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
               style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            🧠
          </div>
          <div>
            <p className="font-bold text-sm text-white">Consistent AI</p>
            <p className="text-[10px] text-[#6b7280] uppercase tracking-widest">Sales Intelligence</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="px-3 mb-2 text-[10px] font-semibold tracking-widest text-[#4b5563] uppercase">Modules</p>
        {NAV.map(({ href, icon: Icon, label, desc }) => {
          const active = path === href || (href !== "/" && path.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
                active
                  ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 text-white"
                  : "text-[#9ca3af] hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <Icon size={16} className={active ? "text-indigo-400" : "text-[#6b7280] group-hover:text-[#9ca3af]"} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{label}</p>
                <p className="text-[10px] text-[#4b5563] truncate group-hover:text-[#6b7280]">{desc}</p>
              </div>
              {active && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/[0.06]">
        <p className="text-[10px] text-[#374151]">v2.0 · FastAPI + Next.js</p>
      </div>
    </aside>
  );
}
