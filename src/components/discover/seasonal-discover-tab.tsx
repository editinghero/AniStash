import { useState, useEffect } from "react";
import {
  Sparkles,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  Star,
  Film,
  BookOpen,
  RefreshCw,
  Info,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import {
  CATEGORIES,
  DISCOVER_SORTS,
  SEASONS,
  currentSeason,
  fetchDiscoverMedia,
  type DiscoverSort,
  type MediaSeason,
  type DiscoverMediaItem,
} from "@/lib/anilist-discover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLibrary } from "@/lib/use-library";
import { upsertEntry } from "@/lib/repo/library";
import { ThinkingProcess } from "@/components/ui/thinking-process";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { DiscoverMediaDialog } from "./discover-media-dialog";
import { cn } from "@/lib/utils";

export function SeasonalDiscoverTab() {
  const initial = currentSeason();
  const [mediaType, setMediaType] = useState<"ANIME" | "MANGA">("ANIME");
  const [season, setSeason] = useState<MediaSeason>(initial.season);
  const [year, setYear] = useState<number>(initial.year);
  const [selectedGenre, setSelectedGenre] = useState<string>("ALL");
  const [sort, setSort] = useState<DiscoverSort>("POPULARITY_DESC");
  const [page, setPage] = useState<number>(1);
  const [hasNextPage, setHasNextPage] = useState<boolean>(true);

  const [items, setItems] = useState<DiscoverMediaItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Detail State
  const [selectedMedia, setSelectedMedia] = useState<DiscoverMediaItem | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = useState<boolean>(false);

  // AI Briefing State
  const [briefingText, setBriefingText] = useState<string>("");
  const [briefingThought, setBriefingThought] = useState<string>("");
  const [isGeneratingBriefing, setIsGeneratingBriefing] =
    useState<boolean>(false);

  const library = useLibrary();
  const inLibrarySet = new Set(
    library.filter((e) => e.anilistId).map((e) => e.anilistId as number),
  );

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [mediaType, season, year, selectedGenre, sort]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    fetchDiscoverMedia({
      type: mediaType,
      season: mediaType === "ANIME" ? season : null,
      seasonYear: mediaType === "ANIME" ? year : null,
      genre: selectedGenre,
      sort,
      page,
      perPage: 25,
    })
      .then((data) => {
        if (active) {
          setItems(data.media);
          setHasNextPage(data.hasNextPage);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          console.error("Discover load error:", err);
          setError("Failed to load seasonal media chart.");
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [mediaType, season, year, selectedGenre, sort, page]);

  const handlePrevPage = () => {
    if (page > 1) setPage((p) => p - 1);
  };

  const handleNextPage = () => {
    if (hasNextPage) setPage((p) => p + 1);
  };

  const handleCardClick = (media: DiscoverMediaItem) => {
    setSelectedMedia(media);
    setDetailOpen(true);
  };

  const handleQuickAdd = (e: React.MouseEvent, media: DiscoverMediaItem) => {
    e.stopPropagation(); // prevent opening modal
    const title = media.title.english || media.title.romaji || "Untitled";
    upsertEntry({
      type: media.type === "MANGA" ? "MANGA" : "ANIME",
      status: "PLANNING",
      anilistId: media.id,
      malId: media.idMal ?? undefined,
      title: media.title.romaji || title,
      englishTitle: media.title.english ?? undefined,
      nativeTitle: media.title.native ?? undefined,
      coverImage:
        media.coverImage.extraLarge || media.coverImage.large || undefined,
      bannerImage: media.bannerImage ?? undefined,
      genres: media.genres || [],
      format: media.format ?? undefined,
      episodes: media.episodes ?? undefined,
      chapters: media.chapters ?? undefined,
      averageScore: media.averageScore ?? undefined,
      description: media.description ?? undefined,
      progress: 0,
      notes: "",
    });
    toast.success(`"${title}" added to Planned`);
  };

  const handleGenerateBriefing = async () => {
    if (items.length === 0 || isGeneratingBriefing) return;
    setIsGeneratingBriefing(true);
    setBriefingText("");
    setBriefingThought("");

    try {
      const titles = items
        .map((m) => m.title.english || m.title.romaji || "")
        .filter(Boolean);
      const res = await fetch("/api/ai/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: mediaType,
          season: mediaType === "ANIME" ? season : undefined,
          year: mediaType === "ANIME" ? year : undefined,
          genre: selectedGenre !== "ALL" ? selectedGenre : undefined,
          titles,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate briefing.");
      }

      setBriefingText(data.text);
      if (data.thought) setBriefingThought(data.thought);
      toast.success("AI briefing generated");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate AI briefing");
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  const currentSortObj =
    DISCOVER_SORTS.find((s) => s.value === sort) || DISCOVER_SORTS[0];

  return (
    <div className="space-y-6 animate-page-in">
      {/* Top Filter Bar */}
      <div className="rounded-3xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] p-4 sm:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Media Type Switch (Fully Rounded Pill) */}
          <div className="flex items-center gap-1 rounded-full bg-[rgba(255,243,224,0.04)] p-1 border border-[rgba(255,243,224,0.08)] self-start">
            <button
              type="button"
              onClick={() => setMediaType("ANIME")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 active:scale-95 ${
                mediaType === "ANIME"
                  ? "bg-[#f0788a] text-white shadow-[0_0_14px_rgba(240,120,138,0.35)]"
                  : "text-[#968677] hover:text-[#fff3e0]"
              }`}
            >
              <Film className="h-3.5 w-3.5" />
              <span>Anime</span>
            </button>
            <button
              type="button"
              onClick={() => setMediaType("MANGA")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 active:scale-95 ${
                mediaType === "MANGA"
                  ? "bg-[#f0788a] text-white shadow-[0_0_14px_rgba(240,120,138,0.35)]"
                  : "text-[#968677] hover:text-[#fff3e0]"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Manga</span>
            </button>
          </div>

          {/* Top Pagination + Custom Sort Dropdown */}
          <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
            {/* Pagination Controls with responsive text */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                type="button"
                disabled={page <= 1 || isLoading}
                onClick={handlePrevPage}
                className="inline-flex items-center justify-center gap-1 h-8 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.03)] px-2.5 sm:px-3 text-xs font-semibold text-[#dbc9b5] hover:text-[#fff3e0] hover:scale-[1.02] active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Previous Page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Prev</span>
              </button>

              <span className="rounded-full bg-[rgba(255,243,224,0.06)] px-2.5 sm:px-3 py-1 text-xs font-bold text-[#fff3e0] tabular-nums">
                <span className="hidden sm:inline">Page </span>
                {page}
              </span>

              <button
                type="button"
                disabled={!hasNextPage || isLoading}
                onClick={handleNextPage}
                className="inline-flex items-center justify-center gap-1 h-8 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.03)] px-2.5 sm:px-3 text-xs font-semibold text-[#dbc9b5] hover:text-[#fff3e0] hover:scale-[1.02] active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Next Page"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Custom Glassmorphic Sort Dropdown Menu (No "Sort" word) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] px-3 text-xs font-semibold text-[#dbc9b5] shadow-sm backdrop-blur-xl hover:border-[rgba(240,120,138,0.4)] hover:text-[#fff3e0] hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                  title="Sort"
                >
                  <SlidersHorizontal className="h-3 w-3 text-[#f0788a]" />
                  <span className="text-[#fff3e0] font-medium text-xs">
                    {currentSortObj.label}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-40 rounded-2xl border border-[rgba(255,243,224,0.09)] bg-[rgba(34,25,26,0.95)] backdrop-blur-2xl p-1 shadow-2xl"
              >
                {DISCOVER_SORTS.map((s) => (
                  <DropdownMenuItem
                    key={s.value}
                    onClick={() => setSort(s.value)}
                    className={cn(
                      "rounded-xl text-xs cursor-pointer py-1.5 px-2.5",
                      sort === s.value &&
                        "text-[#f0788a] font-semibold bg-[rgba(240,120,138,0.12)]",
                    )}
                  >
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Seasonal Controls (for Anime) */}
        {mediaType === "ANIME" && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[rgba(255,243,224,0.06)]">
            <div
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              className="flex items-center gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden"
            >
              {SEASONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeason(s)}
                  className={`rounded-full px-3.5 py-1 text-xs font-medium capitalize transition-all duration-200 active:scale-95 whitespace-nowrap ${
                    season === s
                      ? "bg-[#f0788a] text-white shadow-[0_0_12px_rgba(240,120,138,0.3)] font-semibold"
                      : "border border-[rgba(255,243,224,0.08)] text-[#968677] hover:text-[#fff3e0] hover:scale-[1.02] bg-[rgba(255,243,224,0.02)]"
                  }`}
                >
                  {s.toLowerCase()}
                </button>
              ))}

              {/* Custom Glassmorphic Year Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] px-3 py-1 text-xs font-semibold text-[#fff3e0] hover:border-[rgba(240,120,138,0.4)] hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                  >
                    <Calendar className="h-3 w-3 text-[#f0788a]" />
                    <span>{year}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-32 max-h-60 overflow-y-auto stash-scrollbar rounded-2xl border border-[rgba(255,243,224,0.09)] bg-[rgba(34,25,26,0.95)] backdrop-blur-2xl p-1 shadow-2xl"
                >
                  {Array.from(
                    { length: 14 },
                    (_, i) => initial.year + 1 - i,
                  ).map((y) => (
                    <DropdownMenuItem
                      key={y}
                      onClick={() => setYear(y)}
                      className={cn(
                        "rounded-xl text-xs cursor-pointer py-1.5 px-2.5",
                        year === y &&
                          "text-[#f0788a] font-semibold bg-[rgba(240,120,138,0.12)]",
                      )}
                    >
                      {y}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        {/* Category Pills */}
        <div
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 [&::-webkit-scrollbar]:hidden"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#968677] mr-1 shrink-0">
            Genre:
          </span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedGenre(cat)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs transition-all duration-200 active:scale-95 whitespace-nowrap ${
                selectedGenre === cat
                  ? "bg-[#f0788a] text-white shadow-[0_0_12px_rgba(240,120,138,0.3)] font-semibold"
                  : "border border-[rgba(255,243,224,0.08)] text-[#968677] hover:text-[#fff3e0] hover:scale-[1.02] bg-[rgba(255,243,224,0.02)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Media Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[rgba(255,243,224,0.06)] bg-[rgba(34,25,26,0.5)] p-3 space-y-3 animate-pulse"
            >
              <div className="aspect-[3/4] w-full rounded-xl bg-[rgba(255,243,224,0.05)]" />
              <div className="h-4 w-3/4 rounded bg-[rgba(255,243,224,0.05)]" />
              <div className="h-3 w-1/2 rounded bg-[rgba(255,243,224,0.03)]" />
              <div className="h-8 w-full rounded-full bg-[rgba(255,243,224,0.05)]" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-[rgba(224,46,42,0.3)] bg-[rgba(224,46,42,0.06)] p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-[#e02e2a]">{error}</p>
          <p className="text-xs text-[#968677]">
            Please check your network connection and retry.
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.6)] p-12 text-center text-[#968677] space-y-2">
          <p className="text-sm font-medium text-[#fff3e0]">No titles found</p>
          <p className="text-xs">Try selecting a different genre or season.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {items.map((media) => {
              const inLibrary = inLibrarySet.has(media.id);
              const title =
                media.title.english || media.title.romaji || "Untitled";
              const score = media.averageScore;

              return (
                <div
                  key={media.id}
                  onClick={() => handleCardClick(media)}
                  className="group relative flex flex-col justify-between rounded-2xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all duration-300 hover:border-[#f0788a]/50 hover:shadow-[0_12px_32px_rgba(240,120,138,0.15)] hover:scale-[1.02] cursor-pointer overflow-hidden"
                >
                  {/* Media Image */}
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-[rgba(25,18,19,0.8)]">
                    {media.coverImage?.extraLarge || media.coverImage?.large ? (
                      <img
                        src={
                          media.coverImage.extraLarge ||
                          media.coverImage.large ||
                          ""
                        }
                        alt={title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[#968677]">
                        No Image
                      </div>
                    )}

                    {/* Score badge */}
                    {score != null && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full border border-[rgba(255,243,224,0.15)] bg-[rgba(25,18,19,0.85)] px-2 py-0.5 text-[11px] font-bold text-[#fff3e0] shadow-md backdrop-blur-md">
                        <Star className="h-3 w-3 text-[#f0788a] fill-[#f0788a]" />
                        <span>{score}%</span>
                      </div>
                    )}

                    {/* Format tag */}
                    {media.format && (
                      <div className="absolute bottom-2 left-2 rounded-md bg-[rgba(25,18,19,0.85)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#dbc9b5] backdrop-blur-md border border-[rgba(255,243,224,0.1)]">
                        {media.format}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="mt-2.5 flex-1 space-y-1">
                    <h3
                      className="line-clamp-2 font-display text-xs sm:text-sm font-semibold text-[#fff3e0] transition-colors group-hover:text-[#f0788a]"
                      title={title}
                    >
                      {title}
                    </h3>

                    {media.genres && media.genres.length > 0 && (
                      <p className="line-clamp-1 text-[10px] text-[#968677]">
                        {media.genres.slice(0, 2).join(" · ")}
                      </p>
                    )}
                  </div>

                  {/* Quick Actions Row */}
                  <div className="mt-3 pt-2 border-t border-[rgba(255,243,224,0.06)] flex items-center gap-1.5">
                    {inLibrary ? (
                      <div className="flex items-center justify-center gap-1 h-8 flex-1 rounded-full bg-[rgba(255,243,224,0.05)] text-[11px] font-medium text-[#dbc9b5]">
                        <Check className="h-3.5 w-3.5 text-[#f0788a]" />
                        <span>In Stash</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleQuickAdd(e, media)}
                        className="inline-flex items-center justify-center gap-1 h-8 flex-1 rounded-full border border-[rgba(240,120,138,0.3)] bg-[rgba(240,120,138,0.08)] text-[11px] font-semibold text-[#f0788a] hover:scale-[1.02] active:scale-95 transition-all duration-200"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Plan</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCardClick(media)}
                      className="h-8 w-8 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.03)] text-[#968677] hover:text-[#fff3e0] hover:scale-[1.08] active:scale-95 flex items-center justify-center transition-all duration-200"
                      title="View Details"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Pagination Bar with responsive text */}
          <div className="flex items-center justify-center gap-2 pt-4 pb-2">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={handlePrevPage}
              className="inline-flex items-center gap-1 rounded-full px-3.5 sm:px-4 h-9 border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] text-xs font-semibold text-[#dbc9b5] hover:text-[#fff3e0] hover:scale-[1.02] active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Previous Page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Previous Page</span>
            </button>

            <span className="rounded-full bg-[rgba(255,243,224,0.08)] px-4 py-2 text-xs font-bold text-[#fff3e0] tabular-nums">
              <span className="hidden sm:inline">Page </span>
              {page}
            </span>

            <button
              type="button"
              disabled={!hasNextPage || isLoading}
              onClick={handleNextPage}
              className="inline-flex items-center gap-1 rounded-full px-3.5 sm:px-4 h-9 border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] text-xs font-semibold text-[#dbc9b5] hover:text-[#fff3e0] hover:scale-[1.02] active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Next Page"
            >
              <span className="hidden sm:inline">Next Page</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}

      {/* AI Briefing Section */}
      <div className="rounded-3xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] p-5 sm:p-6 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#f0788a] mb-1">
              <Sparkles className="h-3.5 w-3.5 text-[#f0788a]" />
              <span>AI Briefing</span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#fff3e0]">
              {mediaType === "ANIME"
                ? `${season.toLowerCase()} ${year} Seasonal Overview`
                : `${selectedGenre === "ALL" ? "Trending" : selectedGenre} Manga Briefing`}
            </h2>
            <p className="text-xs text-[#968677]">
              Spoiler-free executive breakdown of standout premises, studio
              highlights, and themes.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerateBriefing}
            disabled={isGeneratingBriefing || items.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#f0788a] text-white text-xs font-semibold px-4 py-2 shadow-[0_0_16px_rgba(240,120,138,0.3)] hover:scale-[1.02] active:scale-95 disabled:opacity-50 self-start sm:self-auto transition-all duration-200"
          >
            {isGeneratingBriefing ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Briefing...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Brief me</span>
              </>
            )}
          </button>
        </div>

        {briefingThought && (
          <div className="pt-2">
            <ThinkingProcess thought={briefingThought} />
          </div>
        )}

        {briefingText && (
          <div className="rounded-2xl border border-[rgba(255,243,224,0.08)] bg-[rgba(25,18,19,0.85)] p-4 sm:p-5 text-xs sm:text-sm text-[#dbc9b5] leading-relaxed shadow-sm">
            <MarkdownRenderer content={briefingText} variant="basic" />
          </div>
        )}
      </div>

      {/* Media Detail Popup Dialog */}
      <DiscoverMediaDialog
        media={selectedMedia}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
