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
  blue: "bg-primary-50 text-primary-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
};

export default function StatCard({ title, value, icon: Icon, trend, color = "blue", href }: StatCardProps) {
  const content = (
    <div className={cn(
      "rounded-xl border border-slate-200 bg-white p-6",
      href && "hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
    )}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={cn("rounded-lg p-2", colorMap[color])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
      {trend && <p className="mt-1 text-xs text-slate-500">{trend}</p>}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
