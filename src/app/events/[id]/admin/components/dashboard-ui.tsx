import Link from "next/link";
import { type ReactNode } from "react";

export function StatCard({
  title,
  value,
  icon,
  alert = false,
}: {
  title: string;
  value: string | number;
  icon: ReactNode;
  alert?: boolean;
}) {
  return (
    <div className={`p-4 md:p-6 rounded-2xl border bg-white/10 dark:bg-black/10 backdrop-blur-md shadow-sm flex items-center gap-3 md:gap-4 ${alert && value && Number(value) > 0 ? "border-amber-500/50" : "border-slate-200 dark:border-slate-800"}`}>
      <div className={`p-2.5 md:p-3 rounded-full ${alert && value && Number(value) > 0 ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-500" : "bg-primary/10 text-primary"}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs md:text-sm font-medium text-muted-foreground">{title}</p>
        <h3 className="text-xl md:text-2xl font-bold">{value}</h3>
      </div>
    </div>
  );
}

export function ActionTile({
  href,
  label,
  icon,
  badgeCount,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  badgeCount?: number;
}) {
  return (
    <Link
      href={href}
      className="relative flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 transition-all hover:scale-[1.02] hover:shadow-md focus:ring-2 focus:ring-primary focus:outline-none"
    >
      {badgeCount !== undefined && badgeCount > 0 && (
        <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {badgeCount}
        </span>
      )}
      <div className="text-primary [&>svg]:h-8 [&>svg]:w-8">{icon}</div>
      <span className="text-sm font-semibold text-center">{label}</span>
    </Link>
  );
}
