import { useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { useLibrary } from "@/lib/use-library";
import { MediaCard } from "@/components/media-card";
import { StatusTabs } from "@/components/status-tabs";
import { ALL_STATUSES, type ListStatus, type MediaType } from "@/lib/types";
import { ArrowDownAZ, ArrowUpDown, Plus, Star } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
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
  score: { label: "Score", shortLabel: "Score", Icon: Star },
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
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const addHref = `/add?type=${type}`;
  const addLabel = type === "SERIES" ? "Add series" : "Add from URL";

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

  const filtered = useMemo(() => {
    const visible = entries.filter((e) => {
      if (status !== "ALL" && e.status !== status) return false;
      if (query) {
        const q = query.toLowerCase();
        const hay =
          `${e.title} ${e.englishTitle ?? ""} ${e.nativeTitle ?? ""} ${(e.genres ?? []).join(" ")}`.toLowerCase();
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
          a.userScore ?? (a.averageScore != null ? a.averageScore / 10 : null);
        const bScore =
          b.userScore ?? (b.averageScore != null ? b.averageScore / 10 : null);
        if (aScore == null && bScore == null) return b.updatedAt - a.updatedAt;
        if (aScore == null) return 1;
        if (bScore == null) return -1;
        return bScore - aScore || b.updatedAt - a.updatedAt;
      }
      return b.updatedAt - a.updatedAt;
    });
  }, [entries, status, query, sortMode]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">{intro}</p>
        </div>
        <Link
          to={addHref}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-accent px-4 py-2.5 text-sm font-semibold text-white shadow-card self-start"
        >
          <Plus className="h-4 w-4" /> {addLabel}
        </Link>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <StatusTabs
          type={type}
          value={status}
          counts={counts}
          onChange={setStatus}
        />
        <div className="flex w-full gap-2 lg:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Sort by ${sortOptions[sortMode].label}`}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-surface/60 px-3 text-sm font-semibold text-foreground ring-1 ring-border/60 transition-colors hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {(() => {
                  const Icon = sortOptions[sortMode].Icon;
                  return <Icon className="h-4 w-4" />;
                })()}
                <span className="hidden sm:inline">
                  {sortOptions[sortMode].shortLabel}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="stash-scrollbar w-48 rounded-lg border-border/60 bg-popover/95 p-1.5 shadow-card backdrop-blur"
            >
              <DropdownMenuRadioGroup
                value={sortMode}
                onValueChange={(value) => setSortMode(value as SortMode)}
              >
                {(
                  Object.entries(sortOptions) as [
                    SortMode,
                    (typeof sortOptions)[SortMode],
                  ][]
                ).map(([value, option]) => (
                  <DropdownMenuRadioItem
                    key={value}
                    value={value}
                    className="cursor-pointer rounded-md py-2 text-sm text-foreground transition-colors hover:!bg-white/10 focus:!bg-white/10 focus:!text-foreground data-[highlighted]:!bg-white/10 data-[highlighted]:!text-foreground data-[state=checked]:!bg-white/10"
                  >
                    <option.Icon className="h-4 w-4" />
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            type="search"
            placeholder="Search your list..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 rounded-lg bg-surface/60 px-4 py-2 text-sm ring-1 ring-border/60 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary sm:w-72"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/30 p-16 text-center">
          <p className="font-display text-lg">Nothing here yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {entries.length === 0
              ? "Start by pasting a bookmark URL — we'll do the rest."
              : "Nothing matches that filter."}
          </p>
          {entries.length === 0 && (
            <Link
              to={addHref}
              className="mt-5 inline-flex rounded-lg bg-gradient-accent px-4 py-2 text-sm font-semibold text-white"
            >
              Add your first
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {filtered.map((e) => (
            <MediaCard key={e.id} entry={e} />
          ))}
        </div>
      )}

      {/* hint to use status filter */}
      <p className="text-xs text-muted-foreground pt-2">
        Tip: click the status pill on any card to change it (
        {ALL_STATUSES.length} states).
      </p>
    </main>
  );
}
