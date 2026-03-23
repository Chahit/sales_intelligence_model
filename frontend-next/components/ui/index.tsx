interface PageHeaderProps {
  icon: string;
  title: string;
  subtitle: string;
  badge?: string;
  accentColor?: string;
}

export function PageHeader({ icon, title, subtitle, badge, accentColor = "#6366f1" }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-4 mb-1">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ background: `linear-gradient(135deg, ${accentColor}33, ${accentColor}11)`, border: `1px solid ${accentColor}33` }}
        >
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            {badge && (
              <span
                className="badge text-[10px]"
                style={{ background: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44` }}
              >
                {badge}
              </span>
            )}
          </div>
          <p className="text-sm text-[#6b7280] mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="page-accent-bar mt-3" style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)` }} />
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaPositive?: boolean;
  accentColor?: string;
}

export function MetricCard({ label, value, delta, deltaPositive = true, accentColor = "#6366f1" }: MetricCardProps) {
  return (
    <div className="metric-card">
      <p className="text-xs text-[#6b7280] font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {delta && (
        <p className={`text-xs mt-1 font-medium ${deltaPositive ? "text-emerald-400" : "text-red-400"}`}>
          {delta}
        </p>
      )}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="border border-red-500/30 bg-red-500/10 rounded-lg p-4 text-red-400 text-sm">
      ⚠️ {message}
    </div>
  );
}

export function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 mt-6">
      <div className="h-px flex-1 bg-white/[0.06]" />
      <p className="text-xs font-semibold text-[#4b5563] uppercase tracking-widest">{title}</p>
      <div className="h-px flex-1 bg-white/[0.06]" />
    </div>
  );
}
