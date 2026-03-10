import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: string;
  color?: "blue" | "green" | "amber" | "red";
}

const colorMap = {
  blue: "bg-primary-600/20 text-primary-400",
  green: "bg-emerald-500/20 text-emerald-400",
  amber: "bg-amber-500/20 text-amber-400",
  red: "bg-red-500/20 text-red-400",
};

export default function StatCard({ title, value, icon: Icon, trend, color = "blue" }: StatCardProps) {
  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900 p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-surface-400">{title}</p>
        <div className={cn("rounded-lg p-2", colorMap[color])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold text-white">{value}</p>
      {trend && <p className="mt-1 text-xs text-surface-500">{trend}</p>}
    </div>
  );
}
