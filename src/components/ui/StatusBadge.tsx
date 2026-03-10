import { cn, getStatusLabel, getStatusColor } from "@/lib/utils";

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        getStatusColor(status)
      )}
    >
      {getStatusLabel(status)}
    </span>
  );
}
