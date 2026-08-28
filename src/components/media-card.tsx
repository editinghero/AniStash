import { useState } from "react";
import { Star } from "lucide-react";
import { statusLabels, type LibraryEntry, type ListStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EntryDetailDialog } from "@/components/entry-detail-dialog";

const statusBadgeClasses: Record<ListStatus, string> = {
  WATCHING:
    "bg-[rgba(240,120,138,0.22)] text-[#f0788a] border-[rgba(240,120,138,0.4)]",
  COMPLETED:
    "bg-[rgba(0,162,64,0.22)] text-[#00a240] border-[rgba(0,162,64,0.4)]",
  PLANNING:
    "bg-[rgba(240,120,138,0.15)] text-[#dbc9b5] border-[rgba(255,243,224,0.2)]",
  ON_HOLD:
    "bg-[rgba(229,169,59,0.22)] text-[#e5a93b] border-[rgba(229,169,59,0.4)]",
  DROPPED:
    "bg-[rgba(224,46,42,0.22)] text-[#e02e2a] border-[rgba(224,46,42,0.4)]",
};

export function MediaCard({ entry }: { entry: LibraryEntry }) {
  const [open, setOpen] = useState(false);
  const labels = statusLabels(entry.type);
  const score = entry.userScore != null ? entry.userScore.toFixed(1) : "-";
  const total =
    entry.type === "MANGA"
      ? entry.chapters
      : entry.type === "SERIES"
        ? undefined
        : entry.episodes;
  const progress = entry.progress ?? 0;
  const progressPct =
    total && total > 0 ? Math.min(100, (progress / total) * 100) : 0;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="group relative w-full cursor-pointer touch-manipulation overflow-hidden rounded-2xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] text-left shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all duration-300 hover:border-[#f0788a]/50 hover:shadow-[0_12px_32px_rgba(240,120,138,0.15)] hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f0788a]"
      >
        {/* Top glowing pink accent line on hover */}
        <div className="pointer-events-none absolute top-0 inset-x-0 h-[2px] bg-[#f0788a] shadow-[0_0_12px_#f0788a] opacity-0 transition-opacity duration-200 group-hover:opacity-100 z-10" />

        <div className="relative aspect-[2/3] overflow-hidden rounded-t-2xl bg-[#191213]">
          {entry.coverImage ? (
            <img
              src={entry.coverImage}
              alt={entry.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="relative grid h-full place-items-center bg-[#22191a] p-3 text-center">
              <div className="absolute inset-0 bg-gradient-to-br from-[#f0788a]/15 to-transparent" />
              <span className="relative line-clamp-5 font-display text-sm font-semibold leading-snug text-[#fff3e0]">
                {entry.englishTitle || entry.title}
              </span>
            </div>
          )}

          {/* Vignette gradient overlay */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#191213]/90 via-[#191213]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

          {/* Score badge */}
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-[rgba(255,243,224,0.12)] bg-[rgba(25,18,19,0.92)] px-2 py-0.5 text-[11px] font-semibold text-[#fff3e0]">
            <Star className="h-3 w-3 fill-[#e5a93b] text-[#e5a93b]" />
            {score}
          </div>

          {/* Status pill on cover */}
          <div
            className={cn(
              "absolute left-2 top-2 truncate rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              statusBadgeClasses[entry.status],
            )}
          >
            {labels[entry.status]}
          </div>

          {/* Progress bar */}
          {progressPct > 0 && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
              <div
                className="h-full bg-[#f0788a] shadow-[0_0_8px_rgba(240,120,138,0.5)]"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
        </div>

        <div className="p-3 space-y-1">
          <h3 className="line-clamp-2 font-display text-[13px] sm:text-sm font-semibold leading-snug text-[#fff3e0] group-hover:text-[#f0788a] transition-colors">
            {entry.englishTitle || entry.title}
          </h3>
          <p className="line-clamp-1 text-[11px] text-[#968677]">
            {entry.genres && entry.genres.length > 0
              ? entry.genres.slice(0, 2).join(" · ")
              : (entry.format ?? "")}
            {total != null && (
              <span className="ml-1 text-[#dbc9b5]/70">
                · {progress}/{total}
              </span>
            )}
          </p>
        </div>
      </div>

      {open && (
        <EntryDetailDialog entry={entry} open={open} onOpenChange={setOpen} />
      )}
    </>
  );
}
