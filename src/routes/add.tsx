import { useNavigate, useDocumentMetadata, useRouter } from "@/lib/router";
import { useEffect, useMemo, useState } from "react";
import { parseBookmark } from "@/lib/anilist.functions";
import { searchAnilist, type AnilistMedia } from "@/lib/anilist-client";
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
  CheckCircle2,
  ArrowLeft,
  Tv,
  BookOpen,
  Film,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

function readTypeFromSearch(search: string): MediaType {
  const value = new URLSearchParams(search).get("type")?.toUpperCase();
  return value === "MANGA" || value === "SERIES" || value === "ANIME"
    ? value
    : "ANIME";
}

export default function AddPage() {
  useDocumentMetadata(
    "Add entry — AniStash",
    "Add anime or manga from a URL, or a fully-custom series entry with your own title and notes.",
  );
  const navigate = useNavigate();
  const router = useRouter();
  const requestedType = useMemo(
    () => readTypeFromSearch(router.state.location.search),
    [router.state.location.search],
  );

  const [url, setUrl] = useState("");
  const [type, setType] = useState<MediaType>(requestedType);
  const [status, setStatus] = useState<ListStatus>("PLANNING");
  const [editedTitle, setEditedTitle] = useState("");
  const [aiNotes, setAiNotes] = useState("");
  const [candidates, setCandidates] = useState<AnilistMedia[]>([]);
  const [loading, setLoading] = useState<"parse" | "search" | "save" | null>(
    null,
  );
  const [step, setStep] = useState<"input" | "confirm">("input");
  const [seriesTitle, setSeriesTitle] = useState("");
  const [seriesDescription, setSeriesDescription] = useState("");

  useEffect(() => {
    setType(requestedType);
    setStep("input");
  }, [requestedType]);

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
    const isUrlInput =
      inputVal.startsWith("http://") || inputVal.startsWith("https://");

    if (isUrlInput) {
      setLoading("parse");
      try {
        const res = await parseBookmark({
          url: inputVal,
          hintType: type as "ANIME" | "MANGA",
        });
        setEditedTitle(res.detectedTitle);
        setAiNotes(res.aiNotes ?? "");
        setCandidates(res.candidates);
        setStep("confirm");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to parse bookmark",
        );
      } finally {
        setLoading(null);
      }
    } else {
      setLoading("search");
      try {
        const items = await searchAnilist(inputVal, type as "ANIME" | "MANGA");
        setEditedTitle(inputVal);
        setAiNotes("");
        setCandidates(items);
        setStep("confirm");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to search AniList",
        );
      } finally {
        setLoading(null);
      }
    }
  }

  async function handleResearch() {
    if (!editedTitle.trim()) return;
    setLoading("search");
    try {
      const items = await searchAnilist(
        editedTitle.trim(),
        type as "ANIME" | "MANGA",
      );
      setCandidates(items);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to search AniList",
      );
    } finally {
      setLoading(null);
    }
  }

  async function handleSave(media: AnilistMedia) {
    setLoading("save");
    try {
      const isUrlInput =
        url.trim().startsWith("http://") || url.trim().startsWith("https://");
      const sourceUrl = isUrlInput ? url.trim() : "";
      upsertEntry({
        anilistId: media.id,
        type: media.type === "MANGA" ? "MANGA" : "ANIME",
        status,
        title: media.title.userPreferred || media.title.romaji,
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
    <main className="mx-auto max-w-3xl px-3 sm:px-4 py-4 sm:py-8 space-y-6 animate-page-in">
      <button
        onClick={() =>
          step === "confirm" ? setStep("input") : navigate({ to: "/" })
        }
        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#dbc9b5] hover:text-[#fff3e0] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <header>
        <h1 className="font-display text-2xl sm:text-4xl font-bold text-[#fff3e0]">
          {step === "input" ? "Add a new entry" : "Pick the right match"}
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[#968677]">
          {step === "input"
            ? "Anime & Manga: paste a URL or title, Gemini extracts metadata and AniList fills in rich art and ratings."
            : "Edit the detected title if needed, then choose the correct entry."}
        </p>
      </header>

      {step === "input" && (
        <form
          onSubmit={handleParse}
          className="space-y-4 rounded-3xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] p-5 sm:p-7 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
        >
          <Field label="Type">
            <div className="grid grid-cols-3 gap-1.5 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.03)] p-1 backdrop-blur-xl">
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
                    "inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 py-2 text-xs font-semibold transition-all active:scale-95",
                    type === v
                      ? "bg-[#f0788a] text-white font-bold shadow-[0_0_14px_rgba(240,120,138,0.35)]"
                      : "text-[#dbc9b5] hover:text-[#fff3e0]",
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
                  placeholder="Bocchi the Rock!, Chainsaw Man…"
                  className="w-full rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] px-4 py-2.5 text-xs sm:text-sm text-[#fff3e0] placeholder:text-[#968677] focus:border-[#f0788a] focus:outline-none"
                />
              </Field>
              <Field label="URL (optional)">
                <div className="flex items-center gap-2 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] px-4 focus-within:border-[#f0788a]">
                  <Link2 className="h-4 w-4 text-[#968677]" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://…"
                    className="flex-1 bg-transparent py-2.5 text-xs sm:text-sm text-[#fff3e0] placeholder:text-[#968677] focus:outline-none"
                  />
                </div>
              </Field>
              <Field label="Description (optional)">
                <Textarea
                  rows={3}
                  value={seriesDescription}
                  onChange={(e) => setSeriesDescription(e.target.value)}
                  placeholder="What is it about? Who recommended it?"
                  className="rounded-2xl border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] p-3 text-xs sm:text-sm text-[#fff3e0] placeholder:text-[#968677] focus:border-[#f0788a] resize-none"
                />
              </Field>
            </>
          ) : (
            <Field label="Bookmark URL or Name">
              <div className="flex items-center gap-2 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] px-4 focus-within:border-[#f0788a]">
                <Link2 className="h-4 w-4 text-[#968677]" />
                <input
                  type="text"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste a bookmark URL or search title..."
                  className="flex-1 bg-transparent py-2.5 sm:py-3 text-xs sm:text-sm text-[#fff3e0] placeholder:text-[#968677] focus:outline-none"
                />
              </div>
            </Field>
          )}

          <Field label="Add to list">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ListStatus)}
              className="w-full rounded-full border border-[rgba(255,243,224,0.08)] bg-[#22191a] px-4 py-2.5 text-xs sm:text-sm text-[#fff3e0] focus:border-[#f0788a] focus:outline-none"
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#f0788a] px-4 py-3 text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(240,120,138,0.3)] hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
          >
            {loading === "parse" || loading === "save" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {type === "SERIES"
                  ? "Saving…"
                  : url.trim().startsWith("http://") ||
                      url.trim().startsWith("https://")
                    ? "Extracting title…"
                    : "Searching AniList…"}
              </>
            ) : type === "SERIES" ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Save series
              </>
            ) : (
              <>
                {url.trim().startsWith("http://") ||
                url.trim().startsWith("https://")
                  ? "Detect & find matches"
                  : "Search AniList"}
              </>
            )}
          </button>
        </form>
      )}

      {step === "confirm" && type !== "SERIES" && (
        <div className="space-y-5">
          <div className="rounded-3xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl space-y-3">
            <Field label="Detected title (edit if needed)">
              <input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="w-full rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] px-4 py-2.5 text-xs sm:text-sm text-[#fff3e0] focus:border-[#f0788a] focus:outline-none"
              />
            </Field>
            {aiNotes && (
              <p className="text-xs text-[#968677] italic">
                AI note: {aiNotes}
              </p>
            )}
            <button
              type="button"
              onClick={handleResearch}
              disabled={loading === "search"}
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] px-4 py-2 text-xs font-semibold text-[#fff3e0] hover:bg-[rgba(255,243,224,0.08)] disabled:opacity-50 active:scale-95 transition-all"
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
            <div className="rounded-3xl border border-dashed border-[rgba(255,243,224,0.09)] bg-[rgba(34,25,26,0.5)] p-10 text-center text-xs sm:text-sm text-[#968677]">
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
                  className="group relative flex gap-3 rounded-2xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.75)] p-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-xl hover:border-[rgba(240,120,138,0.4)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.6)] transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <img
                    src={m.coverImage.large ?? m.coverImage.extraLarge ?? ""}
                    alt=""
                    className="h-28 w-20 flex-none rounded-xl object-cover bg-[#191213]"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-semibold text-xs sm:text-sm line-clamp-2 text-[#fff3e0] group-hover:text-[#f0788a] transition-colors">
                      {m.title.english || m.title.romaji}
                    </h3>
                    {m.title.romaji && m.title.english && (
                      <p className="text-[11px] text-[#968677] line-clamp-1">
                        {m.title.romaji}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-[#968677]">
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
                      <p className="mt-1 text-xs font-semibold text-[#00a240]">
                        ★ {(m.averageScore / 10).toFixed(1)} · AniList
                      </p>
                    )}
                    {m.genres && m.genres.length > 0 && (
                      <p className="mt-1 line-clamp-1 text-[10px] text-[#968677]">
                        {m.genres.slice(0, 3).join(" · ")}
                      </p>
                    )}
                  </div>
                  <CheckCircle2 className="h-5 w-5 flex-none text-[#f0788a] opacity-0 group-hover:opacity-100 transition-opacity" />
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
      <label className="text-[11px] font-semibold uppercase tracking-wider text-[#dbc9b5]">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
