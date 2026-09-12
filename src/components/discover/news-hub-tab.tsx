import { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  ExternalLink,
  Clock,
  Newspaper,
  Search,
  Flame,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  NEWS_SOURCES,
  DEFAULT_SOURCE_IDS,
  type NewsArticle,
  type NewsFetchResponse,
} from "@/lib/news-sources";
import { useLibrary } from "@/lib/use-library";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { ThinkingProcess } from "@/components/ui/thinking-process";

function formatRelativeTime(dateStr: string): string {
  try {
    const timestamp = new Date(dateStr).getTime();
    if (isNaN(timestamp)) return "";
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);

    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "yesterday";
    if (diffDays < 14) return `${diffDays}d ago`;

    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function NewsHubTab() {
  const library = useLibrary();

  // RSS News Feed State
  const [selectedSources, setSelectedSources] =
    useState<string[]>(DEFAULT_SOURCE_IDS);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(12);
  const [isLoadingNews, setIsLoadingNews] = useState<boolean>(true);
  const [isRefreshingNews, setIsRefreshingNews] = useState<boolean>(false);
  const [newsFilterQuery, setNewsFilterQuery] = useState<string>("");
  const [showSourceSelector, setShowSourceSelector] = useState<boolean>(false);
  const [failedSources, setFailedSources] = useState<string[]>([]);

  // AI Digest State
  const [digestTopic, setDigestTopic] = useState<string>("");
  const [digestText, setDigestText] = useState<string>("");
  const [digestThought, setDigestThought] = useState<string>("");
  const [isGeneratingDigest, setIsGeneratingDigest] = useState<boolean>(false);

  const fetchLiveNews = useCallback(
    async (sources = selectedSources) => {
      if (sources.length === 0) return;
      setIsRefreshingNews(true);

      try {
        const res = await fetch("/api/news/feed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceIds: sources }),
        });

        const data = (await res.json()) as NewsFetchResponse;
        if (res.ok) {
          setArticles(data.articles || []);
          setFailedSources(data.failedSources || []);
          setVisibleCount(12);
        } else {
          toast.error("Could not refresh news feeds");
        }
      } catch (e) {
        console.error("Failed to load news feeds", e);
        toast.error("Network error while loading news");
      } finally {
        setIsRefreshingNews(false);
        setIsLoadingNews(false);
      }
    },
    [selectedSources],
  );

  useEffect(() => {
    fetchLiveNews();
  }, [fetchLiveNews]);

  const toggleSource = (sourceId: string) => {
    setSelectedSources((prev) => {
      if (prev.includes(sourceId)) {
        if (prev.length === 1) return prev; // keep at least 1
        return prev.filter((id) => id !== sourceId);
      }
      return [...prev, sourceId];
    });
  };

  const selectAllSources = () => {
    setSelectedSources(NEWS_SOURCES.map((s) => s.id));
  };

  const resetDefaultSources = () => {
    setSelectedSources(DEFAULT_SOURCE_IDS);
  };

  const generateDigest = async (type: "weekly" | "watchlist" | "custom") => {
    if (isGeneratingDigest) return;
    setIsGeneratingDigest(true);
    setDigestText("");
    setDigestThought("");

    const payload: {
      topic?: string;
      customShows?: string[];
      allowSpoilers: boolean;
    } = {
      allowSpoilers: false,
    };

    if (type === "watchlist") {
      const watchingTitles = library
        .filter((e) => e.status === "WATCHING")
        .map((e) => e.englishTitle || e.title)
        .slice(0, 15);

      if (watchingTitles.length === 0) {
        toast.info(
          "No watching titles in your stash. Generating industry digest instead.",
        );
      } else {
        payload.customShows = watchingTitles;
      }
    } else if (type === "custom" && digestTopic.trim()) {
      payload.topic = digestTopic.trim();
    }

    try {
      const res = await fetch("/api/ai/news-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate digest");
      }

      setDigestText(data.text);
      if (data.thought) setDigestThought(data.thought);
      toast.success("AI news digest ready");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate news digest");
    } finally {
      setIsGeneratingDigest(false);
    }
  };

  const filteredArticles = articles.filter((a) => {
    if (!newsFilterQuery.trim()) return true;
    const q = newsFilterQuery.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      (a.description || "").toLowerCase().includes(q) ||
      a.sourceName.toLowerCase().includes(q)
    );
  });

  const visibleArticles = filteredArticles.slice(0, visibleCount);

  return (
    <div className="space-y-6 animate-page-in">
      {/* 1. AI News Digest Section */}
      <div className="rounded-3xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] p-5 sm:p-6 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#f0788a] mb-1">
              <Sparkles className="h-3.5 w-3.5 text-[#f0788a]" />
              <span>AI News Digest</span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#fff3e0]">
              AI Anime News Digest
            </h2>
            <p className="text-xs text-[#968677]">
              Get real-time news briefs summarizing recent anime, manga, and
              adaptation updates with exact dates.
            </p>
          </div>
        </div>

        {/* Digest Quick Presets (Native buttons with scale and zero color changes) */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            disabled={isGeneratingDigest}
            onClick={() => generateDigest("weekly")}
            className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.03)] px-3.5 py-1.5 text-xs font-semibold text-[#dbc9b5] hover:text-[#fff3e0] hover:scale-[1.02] active:scale-95 transition-all duration-200"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#f0788a]" />
            <span>Weekly Industry Digest</span>
          </button>

          <button
            type="button"
            disabled={isGeneratingDigest}
            onClick={() => generateDigest("watchlist")}
            className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.03)] px-3.5 py-1.5 text-xs font-semibold text-[#dbc9b5] hover:text-[#fff3e0] hover:scale-[1.02] active:scale-95 transition-all duration-200"
          >
            <Flame className="h-3.5 w-3.5 text-[#f0788a]" />
            <span>My Watchlist News</span>
          </button>
        </div>

        {/* Custom Topic Bar */}
        <div className="flex items-center gap-2">
          <Input
            value={digestTopic}
            onChange={(e) => setDigestTopic(e.target.value)}
            placeholder="Enter anime title or timeframe (e.g. Chainsaw Man in past 1 month)..."
            className="rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] h-10 text-xs text-[#fff3e0] placeholder:text-[#968677] focus:border-[#f0788a] focus:outline-none transition-all"
            disabled={isGeneratingDigest}
          />
          <button
            type="button"
            onClick={() => generateDigest("custom")}
            disabled={isGeneratingDigest || !digestTopic.trim()}
            className="inline-flex items-center justify-center rounded-full bg-[#f0788a] text-white text-xs font-semibold px-5 h-10 shrink-0 shadow-[0_0_14px_rgba(240,120,138,0.3)] hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all duration-200"
          >
            {isGeneratingDigest ? (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <span>Show News</span>
            )}
          </button>
        </div>

        {/* Digest Output */}
        {digestThought && (
          <div className="pt-2">
            <ThinkingProcess thought={digestThought} />
          </div>
        )}

        {digestText && (
          <div className="rounded-2xl border border-[rgba(255,243,224,0.08)] bg-[rgba(25,18,19,0.85)] p-4 sm:p-5 text-xs sm:text-sm text-[#dbc9b5] leading-relaxed shadow-sm">
            <MarkdownRenderer content={digestText} variant="basic" />
          </div>
        )}
      </div>

      {/* 2. Live RSS Feeds Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-[#f0788a]" />
              <h2 className="font-display text-lg sm:text-xl font-bold text-[#fff3e0]">
                Live Anime News Feed
              </h2>
              {articles.length > 0 && (
                <span className="rounded-full bg-[rgba(240,120,138,0.15)] border border-[rgba(240,120,138,0.3)] px-2.5 py-0.5 text-xs font-bold text-[#f0788a]">
                  {filteredArticles.length}
                </span>
              )}
            </div>
            <p className="text-xs text-[#968677]">
              Aggregated directly from major anime news networks with 14-day
              freshness.
            </p>
          </div>

          {/* Controls: Source Filter & Refresh (Native buttons with scale and zero color changes) */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setShowSourceSelector((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] px-3.5 py-1.5 text-xs font-semibold text-[#dbc9b5] hover:text-[#fff3e0] hover:scale-[1.02] active:scale-95 transition-all duration-200"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#f0788a]" />
              <span>Sources ({selectedSources.length})</span>
            </button>

            <button
              type="button"
              onClick={() => fetchLiveNews()}
              disabled={isRefreshingNews}
              className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] px-3.5 py-1.5 text-xs font-semibold text-[#dbc9b5] hover:text-[#fff3e0] hover:scale-[1.02] active:scale-95 transition-all duration-200"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-[#f0788a] ${
                  isRefreshingNews ? "animate-spin" : ""
                }`}
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Source Selector Pill Bar */}
        {showSourceSelector && (
          <div className="rounded-3xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] p-4 shadow-lg space-y-2 backdrop-blur-xl">
            <div className="flex items-center justify-between text-xs text-[#968677] pb-1">
              <span className="font-semibold text-[#fff3e0]">
                Select Networks:
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={selectAllSources}
                  className="hover:text-[#f0788a] transition-colors"
                >
                  Select all
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={resetDefaultSources}
                  className="hover:text-[#f0788a] transition-colors"
                >
                  Reset defaults
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {NEWS_SOURCES.map((s) => {
                const isSelected = selectedSources.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSource(s.id)}
                    className={`rounded-full px-3.5 py-1 text-xs transition-all duration-200 active:scale-95 whitespace-nowrap ${
                      isSelected
                        ? "bg-[#f0788a] text-white font-semibold shadow-[0_0_10px_rgba(240,120,138,0.25)]"
                        : "border border-[rgba(255,243,224,0.08)] text-[#968677] hover:text-[#fff3e0] bg-[rgba(255,243,224,0.02)] hover:scale-[1.02]"
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>

            {failedSources.length > 0 && (
              <p className="text-[11px] text-[#e02e2a] pt-1">
                Note: {failedSources.length} source(s) were temporarily
                unreachable on last check.
              </p>
            )}
          </div>
        )}

        {/* Search in articles */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#968677]" />
          <Input
            value={newsFilterQuery}
            onChange={(e) => setNewsFilterQuery(e.target.value)}
            placeholder="Search news by keyword..."
            className="pl-10 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.03)] h-10 text-xs text-[#fff3e0] placeholder:text-[#968677] focus:border-[#f0788a] focus:outline-none transition-all"
          />
        </div>

        {/* Articles Grid */}
        {isLoadingNews ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[rgba(255,243,224,0.06)] bg-[rgba(34,25,26,0.5)] p-4 space-y-3 animate-pulse"
              >
                <div className="aspect-video w-full rounded-xl bg-[rgba(255,243,224,0.05)]" />
                <div className="h-4 w-3/4 rounded bg-[rgba(255,243,224,0.05)]" />
                <div className="h-3 w-full rounded bg-[rgba(255,243,224,0.03)]" />
              </div>
            ))}
          </div>
        ) : visibleArticles.length === 0 ? (
          <div className="rounded-3xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.6)] p-12 text-center text-[#968677] space-y-2">
            <p className="text-sm font-medium text-[#fff3e0]">No news found</p>
            <p className="text-xs">
              Try selecting more sources or clearing your search filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleArticles.map((article) => {
              const timeAgo = formatRelativeTime(article.publishedAt);

              return (
                <article
                  key={article.id}
                  className="group flex flex-col justify-between rounded-2xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all duration-300 hover:border-[#f0788a]/50 hover:shadow-[0_12px_32px_rgba(240,120,138,0.15)] hover:scale-[1.01] overflow-hidden"
                >
                  <div className="space-y-3">
                    {/* Thumbnail if available */}
                    {article.imageUrl && (
                      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[rgba(25,18,19,0.8)]">
                        <img
                          src={article.imageUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display =
                              "none";
                          }}
                        />
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#968677]">
                      <span className="font-bold text-[#f0788a]">
                        {article.sourceName}
                      </span>
                      {timeAgo && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {timeAgo}
                          </span>
                        </>
                      )}
                      {article.category && (
                        <>
                          <span>·</span>
                          <span className="rounded-full bg-[rgba(255,243,224,0.05)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#dbc9b5]">
                            {article.category}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Title */}
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group/link"
                    >
                      <h3 className="line-clamp-2 font-display text-sm font-semibold text-[#fff3e0] transition-colors group-hover/link:text-[#f0788a]">
                        {article.title}
                      </h3>
                    </a>

                    {/* Snippet */}
                    {article.description && (
                      <p className="line-clamp-3 text-xs leading-relaxed text-[#968677]">
                        {article.description}
                      </p>
                    )}
                  </div>

                  {/* External Link */}
                  <div className="mt-4 pt-3 border-t border-[rgba(255,243,224,0.06)] flex items-center justify-between text-xs text-[#968677]">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#f0788a] hover:scale-[1.02] active:scale-95 transition-all duration-200"
                    >
                      <span>Read Original</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Show More */}
        {visibleCount < filteredArticles.length && (
          <div className="pt-4 text-center">
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + 12)}
              className="inline-flex items-center justify-center rounded-full px-6 py-2 text-xs font-semibold border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] text-[#dbc9b5] hover:text-[#fff3e0] hover:scale-[1.02] active:scale-95 transition-all duration-200"
            >
              Show more ({filteredArticles.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
