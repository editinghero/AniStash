import { Link, useDocumentMetadata } from "@/lib/router";
import { useLibrary } from "@/lib/use-library";
import { MediaCard } from "@/components/media-card";
import { ArrowRight, Sparkles, Tv, BookOpen, Film, Link2 } from "lucide-react";

export default function Home() {
  useDocumentMetadata(
    "AniStash — Your anime & manga library",
    "Paste a bookmark URL. AniStash detects the title, fetches the cover and rating, and files it under watching, reading, or plan-to.",
  );
  const anime = useLibrary("ANIME").slice(0, 6);
  const manga = useLibrary("MANGA").slice(0, 6);
  const series = useLibrary("SERIES").slice(0, 6);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-16">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-card p-8 md:p-14 ring-1 ring-border/60 shadow-card">
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-surface/60 px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border/60">
            <Sparkles className="h-3 w-3 text-primary" />
            AI-powered bookmark import
          </span>
          <h1 className="mt-5 font-display text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight">
            Stash every series{" "}
            <span className="text-gradient">worth remembering.</span>
          </h1>
          <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-xl">
            Paste any URL — even a random streaming bookmark — and AniStash
            extracts the title, pulls the cover and score from AniList, and
            files it under <em>Watching</em>, <em>Plan to Watch</em>, or
            whatever fits.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/add"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-accent px-5 py-3 text-sm font-semibold text-white shadow-glow"
            >
              <Link2 className="h-4 w-4" />
              Paste a bookmark
            </Link>
            <Link
              to="/anime"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface/60 px-5 py-3 text-sm font-semibold hover:bg-surface"
            >
              Browse library
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <Section
        title="Anime"
        icon={<Tv className="h-5 w-5" />}
        href="/anime"
        items={anime}
        empty="No anime yet — paste a bookmark to add your first."
      />
      <Section
        title="Manga"
        icon={<BookOpen className="h-5 w-5" />}
        href="/manga"
        items={manga}
        empty="No manga yet — paste a chapter URL to start tracking."
      />
      <Section
        title="Series"
        icon={<Film className="h-5 w-5" />}
        href="/series"
        items={series}
        empty="No series yet — add any web show or drama manually."
      />
    </main>
  );
}

function Section({
  title,
  icon,
  href,
  items,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  href: "/anime" | "/manga" | "/series";
  items: ReturnType<typeof useLibrary>;
  empty: string;
}) {
  return (
    <section>
      <div className="mb-5 flex items-end justify-between">
        <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface text-primary">
            {icon}
          </span>
          {title}
        </h2>
        <Link
          to={href}
          className="text-sm font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/30 p-10 text-center text-sm text-muted-foreground">
          {empty}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {items.map((e) => (
            <MediaCard key={e.id} entry={e} />
          ))}
        </div>
      )}
    </section>
  );
}
