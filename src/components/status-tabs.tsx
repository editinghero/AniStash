import {
  ALL_STATUSES,
  statusLabels,
  type ListStatus,
  type MediaType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type StatusTabsProps = {
  type: MediaType;
  active: ListStatus | "ALL";
  counts: Record<ListStatus | "ALL", number>;
  onChange: (status: ListStatus | "ALL") => void;
};

export function StatusTabs({
  type,
  active,
  counts,
  onChange,
}: StatusTabsProps) {
  const labels = statusLabels(type);
  const total =
    counts.ALL ?? ALL_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);

  const tabs: Array<{ id: ListStatus | "ALL"; label: string; count: number }> =
    [
      { id: "ALL", label: "All", count: total },
      ...ALL_STATUSES.map((s) => ({
        id: s,
        label: labels[s],
        count: counts[s] ?? 0,
      })),
    ];

  return (
    <div
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] p-1 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-2xl max-w-full"
    >
      {tabs.map((tab) => {
        const isSelected = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 sm:px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95",
              isSelected
                ? "bg-[#f0788a] text-white font-bold shadow-[0_0_16px_rgba(240,120,138,0.35)]"
                : "text-[#dbc9b5] hover:text-[#fff3e0] hover:bg-[rgba(255,243,224,0.05)]",
            )}
          >
            <span>{tab.label}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums transition-colors",
                isSelected
                  ? "bg-white/25 text-white font-bold"
                  : "bg-[rgba(255,243,224,0.08)] text-[#968677]",
              )}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
