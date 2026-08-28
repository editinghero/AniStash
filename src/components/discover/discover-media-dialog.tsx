import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Star,
  Flame,
  Plus,
  Check,
  Trophy,
  BarChart3,
  Calendar,
  Film,
  Layers,
  BookOpen,
} from "lucide-react";
import type { DiscoverMediaItem } from "@/lib/anilist-discover";
import { useLibrary } from "@/lib/use-library";
import { upsertEntry } from "@/lib/repo/library";
import { toast } from "sonner";

interface DiscoverMediaDialogProps {
  media: DiscoverMediaItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusColors: Record<string, string> = {
  CURRENT: "#f0788a",
  PLANNING: "#dbc9b5",
  COMPLETED: "#00a240",
  DROPPED: "#e02e2a",
  PAUSED: "#e5a93b",
};

export function DiscoverMediaDialog({
  media,
  open,
  onOpenChange,
}: DiscoverMediaDialogProps) {
  const library = useLibrary();

  if (!media) return null;

  const inLibrary = library.some((e) => e.anilistId === media.id);
  const title = media.title.english || media.title.romaji || "Untitled";
  const coverUrl = media.coverImage.extraLarge || media.coverImage.large || "";
  const bannerUrl = media.bannerImage || "";

  const statusDistribution = media.stats?.statusDistribution || [];
  const totalStatusAmount = statusDistribution.reduce(
    (sum, item) => sum + (item.amount || 0),
    0,
  );

  const rankings = media.rankings || [];
  const total = media.type === "MANGA" ? media.chapters : media.episodes;
  const unit = media.type === "MANGA" ? "ch" : "ep";

  const handleAddToPlanned = () => {
    upsertEntry({
      type: media.type === "MANGA" ? "MANGA" : "ANIME",
      status: "PLANNING",
      anilistId: media.id,
      malId: media.idMal ?? undefined,
      title: media.title.romaji || title,
      englishTitle: media.title.english ?? undefined,
      nativeTitle: media.title.native ?? undefined,
      coverImage: coverUrl || undefined,
      bannerImage: bannerUrl || undefined,
      genres: media.genres || [],
      format: media.format ?? undefined,
      episodes: media.episodes ?? undefined,
      chapters: media.chapters ?? undefined,
      averageScore: media.averageScore ?? undefined,
      description: media.description ?? undefined,
      progress: 0,
      notes: "",
    });
    toast.success(`"${title}" added to Planned stash`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] sm:max-w-3xl lg:max-w-4xl max-h-[85vh] sm:max-h-[88vh] p-0 overflow-hidden gap-0 border border-[rgba(255,243,224,0.12)] bg-[#22191a] shadow-[0_24px_80px_rgba(0,0,0,0.85)] rounded-2xl sm:rounded-3xl flex flex-col my-auto text-[#fff3e0] transform-gpu">
        {/* Banner with fixed Parallax Vignette Header */}
        <div className="relative h-28 sm:h-44 md:h-48 w-full overflow-hidden bg-[#191213] shrink-0">
          {bannerUrl ? (
            <img
              src={bannerUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover opacity-60"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-[#f0788a]/20 to-transparent opacity-30" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#22191a] via-[#22191a]/45 to-transparent" />
        </div>

        {/* Scrollable Content Body with true glassmorphic blur */}
        <div className="stash-scrollbar relative -mt-12 sm:-mt-18 px-4 sm:px-8 pb-6 flex-1 overflow-y-auto min-h-0 space-y-4 sm:space-y-6">
          {/* Header Row: Cover & Details */}
          <div className="flex gap-3.5 sm:gap-6 items-start">
            {/* Cover Image */}
            <div className="h-28 w-20 sm:h-40 sm:w-28 flex-none overflow-hidden rounded-xl sm:rounded-2xl border border-[rgba(255,243,224,0.14)] bg-[#191213] shadow-[0_12px_28px_rgba(0,0,0,0.7)]">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-[#968677]">
                  No Cover
                </div>
              )}
            </div>

            {/* Title & Stats */}
            <div className="flex-1 min-w-0 pt-6 sm:pt-12 space-y-2">
              <DialogHeader className="text-left space-y-0.5 sm:space-y-1">
                <DialogTitle className="font-display text-lg sm:text-2xl lg:text-3xl font-bold leading-tight text-[#fff3e0]">
                  {title}
                </DialogTitle>
                {media.title.romaji && media.title.romaji !== title && (
                  <p className="text-xs sm:text-sm text-[#968677] line-clamp-1">
                    {media.title.romaji}
                  </p>
                )}
              </DialogHeader>

              {/* Badges & Meta */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5">
                {media.averageScore != null && (
                  <div className="inline-flex items-center gap-1 rounded-full border border-[rgba(240,120,138,0.3)] bg-[rgba(240,120,138,0.1)] px-2.5 py-0.5 text-xs font-bold text-[#f0788a]">
                    <Star className="h-3 w-3 fill-[#f0788a]" />
                    <span>{media.averageScore}%</span>
                  </div>
                )}
                {media.popularity != null && (
                  <div className="inline-flex items-center gap-1 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] px-2.5 py-0.5 text-xs font-medium text-[#dbc9b5]">
                    <Flame className="h-3 w-3 text-[#f0788a]" />
                    <span>{media.popularity.toLocaleString()}</span>
                  </div>
                )}
                {media.format && (
                  <span className="rounded-full bg-[rgba(255,243,224,0.06)] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-[#dbc9b5]">
                    {media.format}
                  </span>
                )}
                {total != null && (
                  <span className="text-xs text-[#dbc9b5]/80">
                    · {total} {unit}
                  </span>
                )}
                {media.status && (
                  <span className="rounded-full bg-[rgba(255,243,224,0.06)] px-2.5 py-0.5 text-xs font-medium text-[#968677]">
                    {media.status}
                  </span>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-1">
                {inLibrary ? (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(240,120,138,0.4)] bg-[rgba(240,120,138,0.12)] px-4 py-1 text-xs font-semibold text-[#f0788a]">
                    <Check className="h-3.5 w-3.5" />
                    <span>In Your Stash</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleAddToPlanned}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#f0788a] text-white text-xs font-semibold px-4 py-1.5 shadow-[0_0_16px_rgba(240,120,138,0.35)] hover:scale-[1.02] active:scale-95 transition-all duration-200 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add to Planned</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Info Grid (True Glassmorphic Blur) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 rounded-2xl border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] p-3 sm:p-4 text-xs backdrop-blur-xl shadow-sm">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#968677] block mb-0.5">
                Type
              </span>
              <span className="font-semibold text-[#fff3e0]">{media.type}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#968677] block mb-0.5">
                {media.type === "MANGA" ? "Chapters" : "Episodes"}
              </span>
              <span className="font-semibold text-[#fff3e0]">
                {media.type === "MANGA"
                  ? (media.chapters ?? "—")
                  : (media.episodes ?? "—")}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#968677] block mb-0.5">
                Season / Year
              </span>
              <span className="font-semibold text-[#fff3e0]">
                {media.season ? `${media.season} ` : ""}
                {media.startDate?.year ?? "—"}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#968677] block mb-0.5">
                Mean Score
              </span>
              <span className="font-semibold text-[#fff3e0]">
                {media.meanScore ? `${media.meanScore}%` : "—"}
              </span>
            </div>
          </div>

          {/* Box 1: Status Distribution (True Glassmorphic Blur) */}
          {statusDistribution.length > 0 && (
            <div className="rounded-2xl border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] p-4 shadow-sm backdrop-blur-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#fff3e0]">
                  <BarChart3 className="h-3.5 w-3.5 text-[#f0788a]" />
                  <span>Status Distribution</span>
                </div>
                {totalStatusAmount > 0 && (
                  <span className="text-[11px] text-[#968677]">
                    {totalStatusAmount.toLocaleString()} total members
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              {totalStatusAmount > 0 && (
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-[rgba(255,243,224,0.06)]">
                  {statusDistribution.map((item) => {
                    const pct = (item.amount / totalStatusAmount) * 100;
                    return (
                      <div
                        key={item.status}
                        style={{
                          width: `${pct}%`,
                          backgroundColor:
                            statusColors[item.status] || "#968677",
                        }}
                        title={`${item.status}: ${item.amount.toLocaleString()} (${pct.toFixed(1)}%)`}
                      />
                    );
                  })}
                </div>
              )}

              {/* Status Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
                {statusDistribution.map((item) => (
                  <div
                    key={item.status}
                    className="flex items-center justify-between rounded-xl bg-[rgba(255,243,224,0.03)] px-2.5 py-1.5 border border-[rgba(255,243,224,0.06)]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            statusColors[item.status] || "#968677",
                        }}
                      />
                      <span className="text-[11px] font-medium capitalize text-[#dbc9b5]">
                        {item.status.toLowerCase()}
                      </span>
                    </div>
                    <span className="font-semibold text-[#fff3e0] tabular-nums text-[11px]">
                      {item.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Box 2: Rankings (True Glassmorphic Blur) */}
          {rankings.length > 0 && (
            <div className="rounded-2xl border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] p-4 shadow-sm backdrop-blur-xl space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#fff3e0]">
                <Trophy className="h-3.5 w-3.5 text-[#e5a93b]" />
                <span>Rankings & Achievements</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {rankings.slice(0, 4).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 rounded-xl bg-[rgba(255,243,224,0.03)] px-3 py-2 border border-[rgba(255,243,224,0.06)] text-xs"
                  >
                    <span className="font-bold text-[#f0788a] tabular-nums shrink-0">
                      #{r.rank}
                    </span>
                    <span className="text-[#dbc9b5] truncate">
                      {r.context} {r.season ? `${r.season} ` : ""}
                      {r.year ? r.year : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Genres */}
          {media.genres && media.genres.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#968677]">
                Genres
              </span>
              <div className="flex flex-wrap gap-1.5">
                {media.genres.map((g) => (
                  <span
                    key={g}
                    className="rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] px-3 py-1 text-xs text-[#dbc9b5]"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Synopsis (True Glassmorphic Blur) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#968677]">
              Synopsis
            </span>
            <div className="stash-scrollbar max-h-56 overflow-y-auto pr-2 text-xs sm:text-sm text-[#dbc9b5] leading-relaxed whitespace-pre-wrap rounded-2xl border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] p-4 backdrop-blur-xl">
              {media.description ? (
                media.description
                  .replace(/<br\s*\/?>/gi, "\n")
                  .replace(/<[^>]+>/g, "")
              ) : (
                <span className="text-[#968677]">
                  No description available.
                </span>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
