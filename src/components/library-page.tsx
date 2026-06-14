import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useLibrary } from "@/lib/use-library";
import { MediaCard } from "@/components/media-card";
import { StatusTabs } from "@/components/status-tabs";
import {
  ALL_STATUSES,
  type ListStatus,
  type MediaType,
} from "@/lib/types";
import { Plus } from "lucide-react";

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
    return entries.filter((e) => {
      if (status !== "ALL" && e.status !== status) return false;
      if (query) {
        const q = query.toLowerCase();
        const hay = `${e.title} ${e.englishTitle ?? ""} ${e.nativeTitle ?? ""} ${(e.genres ?? []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, status, query]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">{intro}</p>
        </div>
        <Link
          to="/add"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-accent px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card self-start"
        >
          <Plus className="h-4 w-4" /> Add from URL
        </Link>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <StatusTabs type={type} value={status} counts={counts} onChange={setStatus} />
        <input
          type="search"
          placeholder="Search your list…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full lg:w-72 rounded-lg bg-surface/60 px-4 py-2 text-sm ring-1 ring-border/60 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
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
              to="/add"
              className="mt-5 inline-flex rounded-lg bg-gradient-accent px-4 py-2 text-sm font-semibold text-primary-foreground"
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
        Tip: click the status pill on any card to change it ({ALL_STATUSES.length} states).
      </p>
    </main>
  );
}
