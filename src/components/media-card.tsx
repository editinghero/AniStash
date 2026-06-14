import { useState } from "react";
import { Star } from "lucide-react";
import {
  statusLabels,
  type LibraryEntry,
  type ListStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { EntryDetailDialog } from "@/components/entry-detail-dialog";

const statusColor: Record<ListStatus, string> = {
  WATCHING: "bg-status-watching/15 text-status-watching ring-status-watching/30",
  COMPLETED: "bg-status-completed/15 text-status-completed ring-status-completed/30",
  PLANNING: "bg-status-planning/15 text-status-planning ring-status-planning/30",
  ON_HOLD: "bg-status-hold/15 text-status-hold ring-status-hold/30",
  DROPPED: "bg-status-dropped/15 text-status-dropped ring-status-dropped/30",
};

export function MediaCard({ entry }: { entry: LibraryEntry }) {
  const [open, setOpen] = useState(false);
  const labels = statusLabels(entry.type);
  const score = entry.averageScore ? (entry.averageScore / 10).toFixed(1) : null;
  const total =
    entry.type === "MANGA"
      ? entry.chapters
      : entry.type === "SERIES"
        ? undefined
        : entry.episodes;
  const progress = entry.progress ?? 0;
  const progressPct = total && total > 0 ? Math.min(100, (progress / total) * 100) : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative w-full overflow-hidden rounded-2xl bg-gradient-card text-left shadow-card ring-1 ring-border/60 transition-all duration-300 hover:-translate-y-1 hover:ring-primary/50 hover:shadow-glow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-surface">
          {entry.coverImage ? (
            <img
              src={entry.coverImage}
              alt={entry.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            <div className="relative grid h-full place-items-center bg-gradient-card p-3 text-center">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent" />
              <span className="relative line-clamp-5 font-display text-sm font-semibold leading-snug text-foreground/90">
                {entry.englishTitle || entry.title}
              </span>
            </div>
          )}

          {/* gradient overlay */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* score badge */}
          {score && (
            <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-background/85 px-2 py-1 text-[11px] font-semibold backdrop-blur ring-1 ring-border/40">
              <Star className="h-3 w-3 fill-status-planning text-status-planning" />
              {score}
            </div>
          )}

          {/* status pill on cover */}
          <div
            className={cn(
              "absolute left-2 top-2 truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 backdrop-blur-sm",
              statusColor[entry.status],
            )}
          >
            {labels[entry.status]}
          </div>

          {/* progress bar */}
          {progressPct > 0 && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
              <div
                className="h-full bg-gradient-accent"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
        </div>

        <div className="p-2.5 sm:p-3 space-y-1">
          <h3 className="line-clamp-2 font-display text-[13px] sm:text-sm font-semibold leading-snug min-h-[2.4em]">
            {entry.englishTitle || entry.title}
          </h3>
          <p className="line-clamp-1 text-[10px] sm:text-[11px] text-muted-foreground">
            {entry.genres && entry.genres.length > 0
              ? entry.genres.slice(0, 2).join(" · ")
              : entry.format ?? ""}
            {total != null && (
              <span className="ml-1 opacity-70">
                · {progress}/{total}
              </span>
            )}
          </p>
        </div>
      </button>

      <EntryDetailDialog entry={entry} open={open} onOpenChange={setOpen} />
    </>
  );
}
