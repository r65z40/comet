import { cn, getStatusLabel, getStatusColor, getWarrantyLabel, getWarrantyColor } from "@/lib/utils";

export default function StatusBadge({ status, endDate, alwaysInFleet }: { status: string; expired?: boolean; endDate?: string; alwaysInFleet?: boolean }) {
  // "Toujours en parc" overrides all other statuses when active
  if (alwaysInFleet) {
    return (
      <span className="inline-flex items-center justify-center gap-1.5">
        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          Toujours en parc
        </span>
      </span>
    );
  }

  const isEnParc = status === "EN_PARC" || status === "EN_PARC_GARANTIE";

  return (
    <span className="inline-flex items-center justify-center gap-1.5">
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
          getStatusColor(status)
        )}
      >
        {getStatusLabel(status)}
      </span>
      {isEnParc && endDate && (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
            getWarrantyColor(endDate)
          )}
        >
          {getWarrantyLabel(endDate)}
        </span>
      )}
    </span>
  );
}
