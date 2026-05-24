import type { LucideIcon } from "lucide-react";

type Color = "blue" | "emerald" | "rose" | "amber" | "violet";

const COLOR_MAP: Record<Color, { bg: string; ring: string; icon: string }> = {
  blue: { bg: "bg-blue-50", ring: "ring-blue-100", icon: "text-blue-600 bg-blue-100" },
  emerald: { bg: "bg-emerald-50", ring: "ring-emerald-100", icon: "text-emerald-600 bg-emerald-100" },
  rose: { bg: "bg-rose-50", ring: "ring-rose-100", icon: "text-rose-600 bg-rose-100" },
  amber: { bg: "bg-amber-50", ring: "ring-amber-100", icon: "text-amber-600 bg-amber-100" },
  violet: { bg: "bg-violet-50", ring: "ring-violet-100", icon: "text-violet-600 bg-violet-100" },
};

export function StatCard({
  title,
  value,
  icon: Icon,
  color = "blue",
  subtext,
}: {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: Color;
  subtext?: string;
}) {
  const c = COLOR_MAP[color];
  return (
    <div className={`rounded-2xl ${c.bg} ring-1 ${c.ring} p-3 sm:p-5 flex items-start gap-3 sm:gap-4`}>
      <div className={`h-9 w-9 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl grid place-items-center shrink-0 ${c.icon}`}>
        <Icon className="h-4 w-4 sm:h-6 sm:w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wide truncate">{title}</p>
        <p className="text-lg sm:text-2xl font-semibold text-slate-900 mt-0.5 sm:mt-1">{value}</p>
        {subtext && <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">{subtext}</p>}
      </div>
    </div>
  );
}
