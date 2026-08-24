import { Link, useDocumentMetadata } from "@/lib/router";
import { useLibrary } from "@/lib/use-library";
import { MediaCard } from "@/components/media-card";
import { ArrowRight, Sparkles, Tv, BookOpen, Film, Link2 } from "lucide-react";

export default function Home() {
  useDocumentMetadata(
    "AniStash — Your anime & manga library",
    "Paste a bookmark URL. AniStash detects the title, fetches the cover and rating, and files it under watching, reading, or plan-to.",
  );
  const anime = useLibrary("ANIME").slice(0, 5);
  const manga = useLibrary("MANGA").slice(0, 5);
  const series = useLibrary("SERIES").slice(0, 5);

  return (
    <main className="mx-auto max-w-5xl px-3 sm:px-4 py-4 sm:py-8 space-y-12 sm:space-y-16 animate-page-in">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.75)] p-6 sm:p-10 md:p-12 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-all">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(240,120,138,0.12)_0%,transparent_70%)]" />
        
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(240,120,138,0.25)] bg-[rgba(240,120,138,0.1)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#f0788a]">
            <Sparkles className="h-3.5 w-3.5 text-[#f0788a]" />
            <span>AI-Powered Stashing</span>
          </div>

          <h1 className="mt-4 font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#fff3e0] leading-[1.1]">
            Stash every story{" "}
            <span className="text-coral-gradient">
              worth remembering.
            </span>
          </h1>

          <p className="mt-3 text-sm sm:text-base text-[#dbc9b5] max-w-xl leading-relaxed">
            Paste any bookmark URL — AniStash detects the title, fetches rich metadata & cover art, and files it seamlessly into your library.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/add"
              className="inline-flex items-center gap-2 rounded-full bg-[#f0788a] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(240,120,138,0.3)] hover:brightness-110 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <Link2 className="h-4 w-4 text-white" />
              Paste a bookmark
            </Link>
            <Link
              to="/anime"
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,243,224,0.09)] bg-[rgba(255,243,224,0.04)] px-5 py-2.5 text-xs sm:text-sm font-semibold text-[#fff3e0] hover:bg-[rgba(255,243,224,0.08)] hover:border-[rgba(240,120,138,0.4)] hover:scale-[1.02] active:scale-95 transition-all"
            >
              Browse library
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Sections */}
      <Section
        title="Anime"
        icon={<Tv className="h-4 w-4 text-[#f0788a]" />}
        href="/anime"
        items={anime}
        empty="No anime yet — paste a bookmark to add your first."
      />
      <Section
        title="Manga"
        icon={<BookOpen className="h-4 w-4 text-[#f0788a]" />}
        href="/manga"
        items={manga}
        empty="No manga yet — paste a chapter URL to start tracking."
      />
      <Section
        title="Series"
        icon={<Film className="h-4 w-4 text-[#f0788a]" />}
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
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-xl sm:text-2xl font-bold tracking-tight text-[#fff3e0]">
          {icon}
          {title}
        </h2>
        <Link
          to={href}
          className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#f0788a] hover:underline"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.4)] p-8 text-center text-xs sm:text-sm text-[#968677]">
          {empty}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((entry) => (
            <MediaCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </section>
  );
}
