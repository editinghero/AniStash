import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { parseBookmark } from "@/lib/anilist.functions";
import {
  searchAnilist,
  type AnilistMedia,
} from "@/lib/anilist-client";
import { upsertEntry } from "@/lib/repo/library";
import {
  ALL_STATUSES,
  statusLabels,
  type ListStatus,
  type MediaType,
} from "@/lib/types";
import {
  Loader2,
  Link2,
  Search,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  Tv,
  BookOpen,
  Film,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/add")({
  head: () => ({
    meta: [
      { title: "Add entry — AniStash" },
      {
        name: "description",
        content:
          "Add anime or manga from a URL, or a fully-custom series entry with your own title and notes.",
      },
    ],
  }),
  component: AddPage,
});

function AddPage() {
  const navigate = useNavigate();

  const [url, setUrl] = useState("");
  const [type, setType] = useState<MediaType>("ANIME");
  const [status, setStatus] = useState<ListStatus>("PLANNING");
  const [editedTitle, setEditedTitle] = useState("");
  const [aiNotes, setAiNotes] = useState("");
  const [candidates, setCandidates] = useState<AnilistMedia[]>([]);
  const [loading, setLoading] = useState<"parse" | "search" | "save" | null>(null);
  const [step, setStep] = useState<"input" | "confirm">("input");
  const [seriesTitle, setSeriesTitle] = useState("");
  const [seriesDescription, setSeriesDescription] = useState("");

  const labels = statusLabels(type);

  async function handleParse(e: React.FormEvent) {
    e.preventDefault();
    if (type === "SERIES") {
      if (!seriesTitle.trim()) {
        toast.error("Please enter a title");
        return;
      }
      setLoading("save");
      try {
        upsertEntry({
          type: "SERIES",
          status,
          title: seriesTitle.trim(),
          description: seriesDescription.trim() || undefined,
          sourceUrl: url.trim() || undefined,
        });
        toast.success("Added to your library");
        navigate({ to: "/series" });
      } finally {
        setLoading(null);
      }
      return;
    }
    const inputVal = url.trim();
    if (!inputVal) return;
    const isUrlInput = inputVal.startsWith("http://") || inputVal.startsWith("https://");

    if (isUrlInput) {
      setLoading("parse");
      try {
        const res = await parseBookmark({
          data: {
            url: inputVal,
            hintType: type as "ANIME" | "MANGA",
          },
        });
        setType(res.type);
        setEditedTitle(res.title);
        setAiNotes(res.notes);
        setCandidates(res.candidates);
        setStep("confirm");
        if (!res.title) toast.error("Couldn't extract a title. Try editing it manually.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to parse URL");
      } finally {
        setLoading(null);
      }
    } else {
      setLoading("parse");
      try {
        const results = await searchAnilist(
          inputVal,
          type as "ANIME" | "MANGA",
          8,
        );
        setType(type);
        setEditedTitle(inputVal);
        setAiNotes("");
        setCandidates(results);
        setStep("confirm");
        if (results.length === 0) {
          toast.error("No matches found on AniList. Try a different name.");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Search failed");
      } finally {
        setLoading(null);
      }
    }
  }

  async function handleResearch() {
    if (!editedTitle.trim() || type === "SERIES") return;
    setLoading("search");
    try {
      const results = await searchAnilist(
        editedTitle.trim(),
        type as "ANIME" | "MANGA",
        8,
      );
      setCandidates(results);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(null);
    }
  }

  function handleSave(media: AnilistMedia) {
    if (type === "SERIES") return;
    setLoading("save");
    try {
      const isUrlInput = url.trim().startsWith("http://") || url.trim().startsWith("https://");
      const sourceUrl = isUrlInput
        ? url.trim()
        : `https://anilist.co/${media.type.toLowerCase()}/${media.id}`;

      upsertEntry({
        type: type as "ANIME" | "MANGA",
        status,
        anilistId: media.id,
        malId: media.idMal ?? undefined,
        title: media.title.romaji || media.title.english || editedTitle,
        englishTitle: media.title.english ?? undefined,
        nativeTitle: media.title.native ?? undefined,
        coverImage:
          media.coverImage.extraLarge || media.coverImage.large || undefined,
        bannerImage: media.bannerImage ?? undefined,
        genres: media.genres,
        format: media.format ?? undefined,
        episodes: media.episodes ?? undefined,
        chapters: media.chapters ?? undefined,
        averageScore: media.averageScore ?? media.meanScore ?? undefined,
        ageRating: media.isAdult ? "18+" : undefined,
        description: media.description?.replace(/<[^>]+>/g, "") ?? undefined,
        sourceUrl: sourceUrl || undefined,
      });
      toast.success("Added to your library");
      navigate({ to: type === "MANGA" ? "/manga" : "/anime" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <button
        onClick={() => (step === "confirm" ? setStep("input") : navigate({ to: "/" }))}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <header>
        <h1 className="font-display text-3xl md:text-4xl font-bold">
          {step === "input" ? "Add a new entry" : "Pick the right match"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {step === "input"
            ? "Anime & Manga: paste a URL, Gemini extracts the title and AniList fills in covers and scores. Series: fully manual — title, optional URL & description."
            : "Edit the detected title if needed, then choose the correct entry."}
        </p>
      </header>

      {step === "input" && (
        <form
          onSubmit={handleParse}
          className="space-y-4 rounded-2xl bg-gradient-card p-6 ring-1 ring-border/60 shadow-card"
        >
          <Field label="Type">
            <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-surface p-1 ring-1 ring-border/60">
              {(
                [
                  { v: "ANIME", label: "Anime", Icon: Tv },
                  { v: "MANGA", label: "Manga", Icon: BookOpen },
                  { v: "SERIES", label: "Series", Icon: Film },
                ] as const
              ).map(({ v, label, Icon }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setType(v)}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    type === v
                      ? "bg-gradient-accent text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </Field>

          {type === "SERIES" ? (
            <>
              <Field label="Title">
                <input
                  required
                  value={seriesTitle}
                  onChange={(e) => setSeriesTitle(e.target.value)}
                  placeholder="The Bear, Severance, your indie web show…"
                  className="w-full rounded-lg bg-surface px-3 py-2.5 text-sm ring-1 ring-border/60 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </Field>
              <Field label="URL (optional)">
                <div className="flex items-center gap-2 rounded-lg bg-surface ring-1 ring-border/60 focus-within:ring-primary px-3">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://…"
                    className="flex-1 bg-transparent py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
              </Field>
              <Field label="Description (optional)">
                <Textarea
                  rows={3}
                  value={seriesDescription}
                  onChange={(e) => setSeriesDescription(e.target.value)}
                  placeholder="What is it about? Who recommended it?"
                  className="bg-surface resize-none"
                />
              </Field>
            </>
          ) : (
            <Field label="Bookmark URL or Name">
              <div className="flex items-center gap-2 rounded-lg bg-surface ring-1 ring-border/60 focus-within:ring-primary px-3">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste a bookmark URL or search anime/manga name..."
                  className="flex-1 bg-transparent py-3 text-sm placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
            </Field>
          )}

          <Field label="Add to list">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ListStatus)}
              className="w-full rounded-lg bg-surface px-3 py-2 text-sm ring-1 ring-border/60 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {labels[s]}
                </option>
              ))}
            </select>
          </Field>

          <button
            type="submit"
            disabled={
              loading != null ||
              (type === "SERIES" ? !seriesTitle.trim() : !url.trim())
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-accent px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
          >
            {loading === "parse" || loading === "save" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {type === "SERIES"
                  ? "Saving…"
                  : url.trim().startsWith("http://") || url.trim().startsWith("https://")
                    ? "Extracting title…"
                    : "Searching AniList…"}
              </>
            ) : type === "SERIES" ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Save series
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> {url.trim().startsWith("http://") || url.trim().startsWith("https://") ? "Detect & find matches" : "Search AniList"}
              </>
            )}
          </button>
        </form>
      )}

      {step === "confirm" && type !== "SERIES" && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-gradient-card p-5 ring-1 ring-border/60 shadow-card space-y-3">
            <Field label="Detected title (edit if needed)">
              <input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="w-full rounded-lg bg-surface px-3 py-2.5 text-sm ring-1 ring-border/60 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </Field>
            {aiNotes && (
              <p className="text-xs text-muted-foreground italic">
                AI note: {aiNotes}
              </p>
            )}
            <button
              type="button"
              onClick={handleResearch}
              disabled={loading === "search"}
              className="inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm font-medium ring-1 ring-border/60 hover:bg-surface-elevated disabled:opacity-50"
            >
              {loading === "search" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Re-search AniList
            </button>
          </div>

          {candidates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No matches. Edit the title above and try again.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {candidates.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSave(m)}
                  disabled={loading === "save"}
                  className="group flex gap-3 rounded-xl bg-gradient-card p-3 text-left ring-1 ring-border/60 hover:ring-primary/60 hover:shadow-glow transition-all disabled:opacity-50"
                >
                  <img
                    src={m.coverImage.large ?? m.coverImage.extraLarge ?? ""}
                    alt=""
                    className="h-28 w-20 flex-none rounded-md object-cover bg-surface"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-semibold text-sm line-clamp-2">
                      {m.title.english || m.title.romaji}
                    </h3>
                    {m.title.romaji && m.title.english && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {m.title.romaji}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[
                        m.format,
                        m.startDate?.year,
                        m.episodes ? `${m.episodes} ep` : null,
                        m.chapters ? `${m.chapters} ch` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {m.averageScore != null && (
                      <p className="mt-1 text-xs font-medium text-status-completed">
                        ★ {(m.averageScore / 10).toFixed(1)} · AniList
                      </p>
                    )}
                    {m.genres?.length > 0 && (
                      <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                        {m.genres.slice(0, 3).join(" · ")}
                      </p>
                    )}
                  </div>
                  <CheckCircle2 className="h-5 w-5 flex-none text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  );
}