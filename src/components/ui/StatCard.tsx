import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";
import Link from "next/link";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: string;
  color?: "blue" | "green" | "amber" | "red";
  href?: string;
}

const colorMap = {
  blue: "bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400",
  green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  red: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

export default function StatCard({ title, value, icon: Icon, trend, color = "blue", href }: StatCardProps) {
  const content = (
    <div className={cn(
      "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6",
      href && "hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all cursor-pointer"
    )}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <div className={cn("rounded-lg p-2", colorMap[color])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
      {trend && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{trend}</p>}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
