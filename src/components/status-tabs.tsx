import {
  ALL_STATUSES,
  statusLabels,
  type ListStatus,
  type MediaType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  type: MediaType;
  value: ListStatus | "ALL";
  counts: Record<ListStatus | "ALL", number>;
  onChange: (s: ListStatus | "ALL") => void;
}

export function StatusTabs({ type, value, counts, onChange }: Props) {
  const labels = statusLabels(type);
  const tabs: Array<{ key: ListStatus | "ALL"; label: string }> = [
    { key: "ALL", label: "All" },
    ...ALL_STATUSES.map((s) => ({ key: s, label: labels[s] })),
  ];
  return (
    <div className="flex flex-wrap gap-1.5 rounded-xl bg-surface/60 p-1.5 ring-1 ring-border/60">
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-gradient-accent text-white shadow-card"
                : "text-muted-foreground hover:text-foreground hover:bg-surface",
            )}
          >
            {t.label}
            <span
              className={cn(
                "ml-2 text-xs",
                active ? "opacity-80" : "opacity-60",
              )}
            >
              {counts[t.key] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
