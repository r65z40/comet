import { cn, getStatusLabel, getStatusColor } from "@/lib/utils";

export default function StatusBadge({ status, expired }: { status: string; expired?: boolean }) {
  const baseColor = getStatusColor(status);
  const expiredOverride = expired && status === "EN_PARC_GARANTIE"
    ? "bg-red-500/20 text-red-400 border-red-500/30"
    : baseColor;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        expiredOverride
      )}
    >
      {getStatusLabel(status)}
      {status === "RENOUVELE" && (
        <span className="ml-1 text-blue-400">(Renouvelé)</span>
      )}
    </span>
  );
}
