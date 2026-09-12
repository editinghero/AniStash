import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { useLibrary } from "@/lib/use-library";
import { MediaCard } from "@/components/media-card";
import { StatusTabs } from "@/components/status-tabs";
import { ALL_STATUSES, type ListStatus, type MediaType } from "@/lib/types";
import { getCategories, subscribeCategories } from "@/lib/categories";
import {
  ArrowDownAZ,
  ArrowUpDown,
  Plus,
  Search,
  Star,
  Tag,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SortMode = "updated" | "score" | "title";

const sortOptions: Record<
  SortMode,
  { label: string; shortLabel: string; Icon: typeof ArrowUpDown }
> = {
  updated: {
    label: "Latest modified",
    shortLabel: "Latest",
    Icon: ArrowUpDown,
  },
  score: { label: "User Score", shortLabel: "Score", Icon: Star },
  title: { label: "Title", shortLabel: "Title", Icon: ArrowDownAZ },
};

export function LibraryPage({
  type,
  title,
  intro,
}: {
  type: MediaType;
  title: string;
  intro: string;
}) {
  const entries = useLibrary(type);
  const [status, setStatus] = useState<ListStatus | "ALL">("ALL");
  const [category, setCategory] = useState<string>("ALL");
  const [availableCategories, setAvailableCategories] = useState<string[]>(() =>
    getCategories(),
  );
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const addHref = `/add?type=${type}`;
  const addLabel = type === "SERIES" ? "Add series" : "Add from URL";

  useEffect(() => {
    setAvailableCategories(getCategories());
    return subscribeCategories(() => {
      setAvailableCategories([...getCategories()]);
    });
  }, []);

  const counts = useMemo(() => {
    const c: Record<ListStatus | "ALL", number> = {
      ALL: entries.length,
      WATCHING: 0,
      COMPLETED: 0,
      PLANNING: 0,
      ON_HOLD: 0,
      DROPPED: 0,
    };
    for (const e of entries) c[e.status]++;
    return c;
  }, [entries]);

  const categoryCounts = useMemo(() => {
    const catMap: Record<string, number> = {};
    for (const e of entries) {
      if (e.categories && e.categories.length > 0) {
        for (const cat of e.categories) {
          const key = cat.toLowerCase();
          catMap[key] = (catMap[key] || 0) + 1;
        }
      }
    }
    return catMap;
  }, [entries]);

  const filtered = useMemo(() => {
    const visible = entries.filter((e) => {
      if (status !== "ALL" && e.status !== status) return false;

      if (category !== "ALL") {
        const catList = e.categories ?? [];
        const matchesCategory = catList.some(
          (c) => c.toLowerCase() === category.toLowerCase(),
        );
        if (!matchesCategory) return false;
      }

      if (query) {
        const q = query.toLowerCase();
        const hay =
          `${e.title} ${e.englishTitle ?? ""} ${e.nativeTitle ?? ""} ${(e.genres ?? []).join(" ")} ${(e.categories ?? []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...visible].sort((a, b) => {
      if (sortMode === "title") {
        const aTitle = (a.englishTitle || a.title).toLocaleLowerCase();
        const bTitle = (b.englishTitle || b.title).toLocaleLowerCase();
        return aTitle.localeCompare(bTitle);
      }
      if (sortMode === "score") {
        const aScore =
          a.userScore != null && Number.isFinite(a.userScore)
            ? a.userScore
            : null;
        const bScore =
          b.userScore != null && Number.isFinite(b.userScore)
            ? b.userScore
            : null;

        if (aScore == null && bScore == null) return b.updatedAt - a.updatedAt;
        if (aScore == null) return 1;
        if (bScore == null) return -1;
        return bScore - aScore || b.updatedAt - a.updatedAt;
      }
      return b.updatedAt - a.updatedAt;
    });
  }, [entries, status, category, query, sortMode]);

  return (
    <main className="mx-auto max-w-5xl px-3 sm:px-4 py-4 sm:py-8 space-y-5 sm:space-y-7 animate-page-in">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#f0788a] mb-1">
            <span>AniStash Library</span>
          </div>
          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[#fff3e0]">
            {title}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#dbc9b5] max-w-xl">
            {intro}
          </p>
        </div>
        <Link
          to={addHref}
          className="inline-flex items-center gap-2 rounded-full bg-[#f0788a] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-[0_0_18px_rgba(240,120,138,0.3)] hover:brightness-110 hover:scale-[1.02] active:scale-95 transition-all self-start"
        >
          <Plus className="h-4 w-4" /> {addLabel}
        </Link>
      </div>

      {/* Control Bar: Categories & Search */}
      <div className="flex flex-col gap-3.5 border-b border-[rgba(255,243,224,0.07)] pb-4 lg:flex-row lg:items-center lg:justify-between">
        <StatusTabs
          type={type}
          active={status}
          counts={counts}
          onChange={setStatus}
        />
        <div className="flex w-full items-center gap-2 lg:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] px-3.5 text-xs font-semibold text-[#dbc9b5] shadow-sm backdrop-blur-xl hover:border-[rgba(240,120,138,0.4)] hover:text-[#fff3e0] hover:scale-[1.02] active:scale-95 transition-all"
                title="Sort entries"
              >
                <ArrowUpDown className="h-3.5 w-3.5 text-[#f0788a]" />
                <span className="hidden sm:inline">Sort:</span>
                <span className="font-medium text-[#fff3e0]">
                  {sortOptions[sortMode].shortLabel}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44 rounded-2xl border border-[rgba(255,243,224,0.09)] bg-[rgba(34,25,26,0.95)] backdrop-blur-2xl p-1 shadow-2xl"
            >
              <DropdownMenuItem
                onClick={() => setSortMode("updated")}
                className={cn(
                  "rounded-xl text-xs cursor-pointer",
                  sortMode === "updated" &&
                    "text-[#f0788a] font-semibold bg-[rgba(240,120,138,0.12)]",
                )}
              >
                Recently updated
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortMode("title")}
                className={cn(
                  "rounded-xl text-xs cursor-pointer",
                  sortMode === "title" &&
                    "text-[#f0788a] font-semibold bg-[rgba(240,120,138,0.12)]",
                )}
              >
                Alphabetical (A-Z)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortMode("score")}
                className={cn(
                  "rounded-xl text-xs cursor-pointer",
                  sortMode === "score" &&
                    "text-[#f0788a] font-semibold bg-[rgba(240,120,138,0.12)]",
                )}
              >
                Highest score
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="relative flex-1 lg:w-64">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#968677]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, genre, note…"
              className="h-10 w-full rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] pl-9 pr-8 text-xs text-[#fff3e0] placeholder:text-[#968677] shadow-sm backdrop-blur-xl focus:border-[#f0788a] focus:outline-none transition-all"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#968677] hover:text-[#fff3e0]"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Horizontally Scrollable Tags Bar */}
      {availableCategories.length > 0 && (
        <div className="flex items-center gap-2 rounded-2xl border border-[rgba(255,243,224,0.07)] bg-[rgba(34,25,26,0.6)] p-2 sm:p-2.5 backdrop-blur-xl shadow-sm">
          <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#968677] pl-1 shrink-0">
            <Tag className="h-3 w-3 text-[#f0788a]" />
            <span className="hidden sm:inline">Tags</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none scroll-smooth py-0.5">
            <button
              type="button"
              onClick={() => setCategory("ALL")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-md transition-all duration-200 shrink-0 select-none hover:scale-[1.02] active:scale-95",
                category === "ALL"
                  ? "border-transparent bg-[#f0788a] text-white font-bold shadow-[0_0_14px_rgba(240,120,138,0.35)]"
                  : "border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.03)] text-[#dbc9b5] hover:bg-[rgba(255,243,224,0.08)] hover:text-[#fff3e0] hover:border-[rgba(240,120,138,0.3)]",
              )}
            >
              All
            </button>
            {availableCategories.map((cat) => {
              const active = category.toLowerCase() === cat.toLowerCase();
              const count = categoryCounts[cat.toLowerCase()] || 0;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(active ? "ALL" : cat)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-md transition-all duration-200 flex items-center gap-1.5 shrink-0 select-none hover:scale-[1.02] active:scale-95",
                    active
                      ? "border-transparent bg-[#f0788a] text-white font-bold shadow-[0_0_14px_rgba(240,120,138,0.35)]"
                      : "border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.03)] text-[#dbc9b5] hover:bg-[rgba(255,243,224,0.08)] hover:text-[#fff3e0] hover:border-[rgba(240,120,138,0.3)]",
                  )}
                >
                  <span>{cat}</span>
                  {count > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 text-[10px] transition-colors",
                        active
                          ? "bg-white/25 text-white font-bold"
                          : "bg-[rgba(255,243,224,0.08)] text-[#968677]",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid of Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[rgba(255,243,224,0.09)] bg-[rgba(34,25,26,0.6)] p-12 text-center backdrop-blur-xl">
          <p className="font-display text-lg font-semibold text-[#fff3e0]">
            Nothing here yet
          </p>
          <p className="mt-1 text-xs sm:text-sm text-[#968677]">
            {entries.length === 0
              ? "Start by pasting a bookmark URL — we'll do the rest."
              : "Nothing matches that filter."}
          </p>
          {entries.length === 0 && (
            <Link
              to={addHref}
              className="mt-5 inline-flex rounded-full bg-[#f0788a] px-4 py-2 text-xs font-semibold text-white shadow-[0_0_18px_rgba(240,120,138,0.3)] hover:brightness-110 active:scale-95"
            >
              Add your first
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((e) => (
            <MediaCard key={e.id} entry={e} />
          ))}
        </div>
      )}
    </main>
  );
}
