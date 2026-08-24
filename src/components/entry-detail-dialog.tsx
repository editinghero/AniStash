import { useState, useMemo, useRef, useEffect } from "react";
import {
  Star,
  ExternalLink,
  Trash2,
  Tag,
  Plus,
} from "lucide-react";
import {
  ALL_STATUSES,
  statusLabels,
  type LibraryEntry,
  type ListStatus,
} from "@/lib/types";
import { upsertEntry, deleteEntry } from "@/lib/repo/library";
import {
  getCategories,
  addCategory,
  subscribeCategories,
} from "@/lib/categories";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "./ui/markdown-renderer";
import { CardAIChat } from "./card-ai-chat";

const statusRing: Record<ListStatus, string> = {
  WATCHING:
    "border-transparent bg-[rgba(240,120,138,0.2)] text-[#f0788a] shadow-[0_0_12px_rgba(240,120,138,0.25)]",
  COMPLETED:
    "border-transparent bg-[rgba(0,162,64,0.2)] text-[#00a240] shadow-[0_0_12px_rgba(0,162,64,0.25)]",
  PLANNING:
    "border-transparent bg-[rgba(240,120,138,0.12)] text-[#dbc9b5]",
  ON_HOLD:
    "border-transparent bg-[rgba(229,169,59,0.2)] text-[#e5a93b] shadow-[0_0_12px_rgba(229,169,59,0.25)]",
  DROPPED:
    "border-transparent bg-[rgba(224,46,42,0.2)] text-[#e02e2a] shadow-[0_0_12px_rgba(224,46,42,0.25)]",
};

export function EntryDetailDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: LibraryEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState<ListStatus>(entry.status);
  const [progress, setProgress] = useState<number | string>(
    entry.progress ?? 0,
  );
  const [userScore, setUserScore] = useState<number | string>(
    entry.userScore ?? "",
  );
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [startedAt, setStartedAt] = useState(
    entry.startedAt
      ? new Date(entry.startedAt).toISOString().split("T")[0]
      : "",
  );
  const [finishedAt, setFinishedAt] = useState(
    entry.finishedAt
      ? new Date(entry.finishedAt).toISOString().split("T")[0]
      : "",
  );
  const [sourceUrl, setSourceUrl] = useState(entry.sourceUrl ?? "");
  const [entryCategories, setEntryCategories] = useState<string[]>(
    entry.categories ?? [],
  );
  const [allCategories, setAllCategories] = useState<string[]>(() =>
    getCategories(),
  );
  const [newCatInput, setNewCatInput] = useState("");

  const openTimeRef = useRef<number>(0);

  useEffect(() => {
    if (open) {
      openTimeRef.current = Date.now();
    }
  }, [open]);

  useEffect(() => {
    setAllCategories(getCategories());
    return subscribeCategories(() => {
      setAllCategories([...getCategories()]);
    });
  }, []);

  useEffect(() => {
    setStatus(entry.status);
    setProgress(entry.progress ?? 0);
    setUserScore(entry.userScore ?? "");
    setNotes(entry.notes ?? "");
    setStartedAt(
      entry.startedAt
        ? new Date(entry.startedAt).toISOString().split("T")[0]
        : "",
    );
    setFinishedAt(
      entry.finishedAt
        ? new Date(entry.finishedAt).toISOString().split("T")[0]
        : "",
    );
    setSourceUrl(entry.sourceUrl ?? "");
    setEntryCategories(entry.categories ?? []);
    setIsEditing(false);
  }, [entry, open]);

  const labels = statusLabels(entry.type);

  const total =
    entry.type === "MANGA"
      ? entry.chapters
      : entry.type === "SERIES"
        ? undefined
        : entry.episodes;

  const unit =
    entry.type === "MANGA" ? "ch" : entry.type === "SERIES" ? "ep" : "ep";

  const anilistScore = useMemo(() => {
    if (entry.averageScore == null) return null;
    return (entry.averageScore / 10).toFixed(1);
  }, [entry.averageScore]);

  function handleCancelEdit() {
    setStatus(entry.status);
    setProgress(entry.progress ?? 0);
    setUserScore(entry.userScore ?? "");
    setNotes(entry.notes ?? "");
    setStartedAt(
      entry.startedAt
        ? new Date(entry.startedAt).toISOString().split("T")[0]
        : "",
    );
    setFinishedAt(
      entry.finishedAt
        ? new Date(entry.finishedAt).toISOString().split("T")[0]
        : "",
    );
    setSourceUrl(entry.sourceUrl ?? "");
    setEntryCategories(entry.categories ?? []);
    setIsEditing(false);
  }

  function save() {
    const progNum = Number(progress);
    const scoreNum = userScore === "" ? undefined : Number(userScore);

    if (isNaN(progNum) || progNum < 0) {
      toast.error("Progress must be a positive number");
      return;
    }
    if (scoreNum !== undefined && (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 10)) {
      toast.error("Score must be between 0 and 10");
      return;
    }

    try {
      upsertEntry({
        ...entry,
        status,
        progress: progNum,
        userScore: scoreNum,
        notes: notes.trim() || undefined,
        startedAt: startedAt ? new Date(startedAt).getTime() : undefined,
        finishedAt: finishedAt ? new Date(finishedAt).getTime() : undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        categories: entryCategories.length > 0 ? entryCategories : undefined,
      });
      toast.success("Saved");
      setIsEditing(false);
    } catch {
      toast.error("Failed to update entry");
    }
  }

  function remove() {
    if (!confirm(`Remove "${entry.title}" from your library?`)) return;
    try {
      deleteEntry(entry.id);
      toast.success("Removed from library");
      onOpenChange(false);
    } catch {
      toast.error("Failed to remove entry");
    }
  }

  function toggleCategory(cat: string) {
    setEntryCategories((prev) => {
      const exists = prev.some((c) => c.toLowerCase() === cat.toLowerCase());
      if (exists) {
        return prev.filter((c) => c.toLowerCase() !== cat.toLowerCase());
      }
      return [...prev, cat];
    });
  }

  function handleQuickAddCategory(e: React.FormEvent) {
    e.preventDefault();
    const val = newCatInput.trim();
    if (!val) return;
    addCategory(val);
    if (!entryCategories.some((c) => c.toLowerCase() === val.toLowerCase())) {
      setEntryCategories((prev) => [...prev, val]);
    }
    setNewCatInput("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(event) => {
          if (isEditing || Date.now() - openTimeRef.current < 450) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (isEditing || Date.now() - openTimeRef.current < 450) {
            event.preventDefault();
          }
        }}
        onEscapeKeyDown={(event) => {
          if (isEditing) event.preventDefault();
        }}
        className="w-[94vw] sm:max-w-3xl lg:max-w-4xl max-h-[85vh] sm:max-h-[88vh] p-0 overflow-hidden gap-0 border border-[rgba(255,243,224,0.1)] bg-[#22191a] shadow-[0_24px_80px_rgba(0,0,0,0.85)] rounded-2xl sm:rounded-3xl flex flex-col my-auto"
      >
        {/* Banner */}
        <div className="relative h-24 sm:h-44 md:h-48 w-full overflow-hidden bg-[#191213] shrink-0">
          {entry.bannerImage ? (
            <img
              src={entry.bannerImage}
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

        {/* Scrollable Content Body with +9% mobile typography */}
        <div className="stash-scrollbar relative -mt-12 sm:-mt-18 px-4 sm:px-8 pb-5 flex-1 overflow-y-auto min-h-0 space-y-3.5 sm:space-y-5">
          <div className="flex gap-3.5 sm:gap-6">
            <div className="h-24 w-18 sm:h-36 sm:w-26 flex-none overflow-hidden rounded-xl sm:rounded-2xl border border-[rgba(255,243,224,0.12)] bg-[#191213] shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
              {entry.coverImage ? (
                <img
                  src={entry.coverImage}
                  alt={entry.title}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex-1 min-w-0 pt-6 sm:pt-12">
              <DialogHeader className="text-left space-y-0.5 sm:space-y-1">
                <DialogTitle className="font-display text-[17px] sm:text-2xl lg:text-3xl font-bold leading-tight text-[#fff3e0]">
                  {entry.englishTitle || entry.title}
                </DialogTitle>
                {entry.title &&
                  entry.englishTitle &&
                  entry.title !== entry.englishTitle && (
                    <DialogDescription className="text-[12px] sm:text-sm line-clamp-1 text-[#968677]">
                      {entry.title}
                    </DialogDescription>
                  )}
              </DialogHeader>
              <div className="mt-1.5 flex flex-wrap gap-1.5 sm:gap-2 text-[12px] sm:text-sm text-[#dbc9b5]">
                {entry.format && <span className="font-medium">{entry.format}</span>}
                {total != null && (
                  <span>
                    · {total} {unit}
                  </span>
                )}
                {anilistScore && (
                  <span className="inline-flex items-center gap-1 font-semibold text-[#00a240]">
                    <Star className="h-3.5 w-3.5 fill-[#00a240]" />{" "}
                    {anilistScore} AniList
                  </span>
                )}
              </div>
            </div>
          </div>

          {entry.genres && entry.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 sm:gap-2">
              {entry.genres.slice(0, 8).map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-[rgba(255,243,224,0.07)] bg-[rgba(255,243,224,0.03)] px-2.5 sm:px-3 py-0.5 sm:py-1 text-[11px] sm:text-xs font-medium text-[#dbc9b5]"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {entryCategories && entryCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#968677] mr-0.5 flex items-center gap-1">
                <Tag className="h-3 w-3 text-[#f0788a]" /> Tags:
              </span>
              {entryCategories.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 rounded-full border border-[rgba(240,120,138,0.3)] bg-[rgba(240,120,138,0.12)] px-2.5 sm:px-3 py-0.5 sm:py-1 text-[12px] sm:text-xs font-semibold text-[#f0788a]"
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          {entry.description && (
            <div className="line-clamp-4 text-[13.5px] sm:text-sm leading-relaxed text-[#dbc9b5]">
              <MarkdownRenderer content={entry.description} />
            </div>
          )}

          {!isEditing ? (
            <div className="space-y-3.5 sm:space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {/* Status */}
                <div className="rounded-2xl border border-[rgba(255,243,224,0.07)] bg-[rgba(255,243,224,0.03)] p-2.5 sm:p-3.5 backdrop-blur-md">
                  <span className="text-[11px] sm:text-xs uppercase font-bold tracking-wider text-[#968677] block mb-0.5">
                    Status
                  </span>
                  <span
                    className={cn(
                      "inline-block rounded-full border px-2.5 py-0.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider",
                      statusRing[status],
                    )}
                  >
                    {labels[status]}
                  </span>
                </div>

                {/* Progress */}
                <div className="rounded-2xl border border-[rgba(255,243,224,0.07)] bg-[rgba(255,243,224,0.03)] p-2.5 sm:p-3.5 backdrop-blur-md">
                  <span className="text-[11px] sm:text-xs uppercase font-bold tracking-wider text-[#968677] block mb-0.5">
                    Progress
                  </span>
                  <span className="text-[13.5px] sm:text-base font-semibold text-[#fff3e0]">
                    {progress || "0"} {total != null ? `/ ${total}` : ""} {unit}
                  </span>
                </div>

                {/* Score */}
                <div className="rounded-2xl border border-[rgba(255,243,224,0.07)] bg-[rgba(255,243,224,0.03)] p-2.5 sm:p-3.5 backdrop-blur-md">
                  <span className="text-[11px] sm:text-xs uppercase font-bold tracking-wider text-[#968677] block mb-0.5">
                    Your Score
                  </span>
                  <span className="text-[13.5px] sm:text-base font-semibold text-[#fff3e0] inline-flex items-center gap-1">
                    {userScore !== "" ? (
                      <>
                        <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-[#e5a93b] text-[#e5a93b]" />
                        {Number(userScore).toFixed(1)}/10
                      </>
                    ) : (
                      <span className="text-[#968677] font-normal text-[12px] sm:text-xs">
                        Unrated
                      </span>
                    )}
                  </span>
                </div>

                {/* Timeline */}
                <div className="rounded-2xl border border-[rgba(255,243,224,0.07)] bg-[rgba(255,243,224,0.03)] p-2.5 sm:p-3.5 backdrop-blur-md col-span-2 sm:col-span-1">
                  <span className="text-[11px] sm:text-xs uppercase font-bold tracking-wider text-[#968677] block mb-0.5">
                    Timeline
                  </span>
                  <div className="text-[11px] sm:text-xs space-y-0.5 text-[#dbc9b5] font-medium leading-tight">
                    {startedAt ? (
                      <div>
                        Started:{" "}
                        {new Date(startedAt + "T00:00:00").toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </div>
                    ) : null}
                    {finishedAt ? (
                      <div>
                        Finished:{" "}
                        {new Date(finishedAt + "T00:00:00").toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </div>
                    ) : null}
                    {!startedAt && !finishedAt && (
                      <span className="text-[#968677] text-[11px] sm:text-xs font-normal">
                        No dates recorded
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {notes && (
                <div className="rounded-2xl border border-[rgba(255,243,224,0.07)] bg-[rgba(255,243,224,0.02)] p-3 sm:p-4 backdrop-blur-md space-y-1.5">
                  <span className="text-[11px] sm:text-xs uppercase font-bold tracking-wider text-[#968677] block">
                    Personal Notes
                  </span>
                  <div className="text-[13.5px] sm:text-sm leading-relaxed text-[#fff3e0]">
                    <MarkdownRenderer content={notes} />
                  </div>
                </div>
              )}

              {/* Bookmark Link */}
              {entry.sourceUrl && (
                <a
                  href={entry.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[13px] sm:text-sm text-[#dbc9b5] hover:text-[#f0788a] pt-0.5 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Source bookmark
                </a>
              )}

              {/* Single AI Chat Section */}
              <CardAIChat entry={entry} />
            </div>
          ) : (
            <div className="space-y-3.5 sm:space-y-4">
              {/* Status pills */}
              <div>
                <Label className="text-[12px] sm:text-xs font-semibold uppercase tracking-wider text-[#dbc9b5]">
                  Status
                </Label>
                <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2">
                  {ALL_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={cn(
                        "rounded-full border px-2.5 py-1.5 sm:py-2 text-[12px] sm:text-xs font-semibold transition-all active:scale-95",
                        status === s
                          ? statusRing[s]
                          : "border-[rgba(255,243,224,0.07)] bg-[rgba(255,243,224,0.03)] text-[#dbc9b5] hover:text-[#fff3e0] hover:bg-[rgba(255,243,224,0.08)]",
                      )}
                    >
                      {labels[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category / Tags Selector */}
              <div className="rounded-2xl border border-[rgba(255,243,224,0.07)] bg-[rgba(255,243,224,0.03)] p-3 sm:p-3.5 space-y-2 backdrop-blur-md">
                <Label className="text-[12px] sm:text-xs font-semibold uppercase tracking-wider text-[#dbc9b5] inline-flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5 text-[#f0788a]" /> Categories / Tags
                </Label>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {allCategories.map((cat) => {
                    const isSelected = entryCategories.some(
                      (c) => c.toLowerCase() === cat.toLowerCase(),
                    );
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-[12px] sm:text-xs font-semibold transition-all active:scale-95",
                          isSelected
                            ? "border-transparent bg-[#f0788a] text-white shadow-[0_0_12px_rgba(240,120,138,0.35)] font-bold"
                            : "border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] text-[#dbc9b5] hover:bg-[rgba(255,243,224,0.08)] hover:text-[#fff3e0]",
                        )}
                      >
                        {isSelected ? "✓ " : "+ "}
                        {cat}
                      </button>
                    );
                  })}
                </div>
                <form onSubmit={handleQuickAddCategory} className="flex gap-2 pt-1">
                  <Input
                    value={newCatInput}
                    onChange={(e) => setNewCatInput(e.target.value)}
                    placeholder="Create & attach new tag..."
                    className="h-8.5 rounded-full border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] text-[13px] sm:text-xs text-[#fff3e0] placeholder:text-[#968677] focus:border-[#f0788a]"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="h-8.5 rounded-full bg-[#f0788a] px-3.5 text-[12px] sm:text-xs font-semibold text-white shadow-[0_0_12px_rgba(240,120,138,0.3)] shrink-0 active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Tag
                  </Button>
                </form>
              </div>

              {/* Progress + score */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
                <div>
                  <Label
                    htmlFor="progress"
                    className="text-[12px] sm:text-xs font-semibold uppercase tracking-wider text-[#dbc9b5]"
                  >
                    Progress {total != null && `(of ${total})`}
                  </Label>
                  <Input
                    id="progress"
                    type="number"
                    min={0}
                    max={total}
                    value={progress}
                    onChange={(e) => setProgress(e.target.value)}
                    className="mt-1 rounded-full border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] px-3.5 text-[13px] sm:text-sm text-[#fff3e0] focus:border-[#f0788a]"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="score"
                    className="text-[12px] sm:text-xs font-semibold uppercase tracking-wider text-[#dbc9b5]"
                  >
                    Your Score (0–10)
                  </Label>
                  <Input
                    id="score"
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    placeholder="e.g. 8.5"
                    value={userScore}
                    onChange={(e) => setUserScore(e.target.value)}
                    className="mt-1 rounded-full border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] px-3.5 text-[13px] sm:text-sm text-[#fff3e0] focus:border-[#f0788a]"
                  />
                </div>
              </div>

              {/* Expandable Big Personal Notes Section */}
              <div>
                <Label
                  htmlFor="notes"
                  className="text-[12px] sm:text-xs font-semibold uppercase tracking-wider text-[#dbc9b5]"
                >
                  Personal notes
                </Label>
                <Textarea
                  id="notes"
                  rows={5}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Personal thoughts, favorite moments, episode bookmarks, quotes, analysis…"
                  className="mt-1 min-h-[120px] sm:min-h-[180px] w-full rounded-2xl border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] p-3 sm:p-4 text-[13.5px] sm:text-sm text-[#fff3e0] placeholder:text-[#968677] focus:border-[#f0788a] resize-y leading-relaxed font-sans"
                />
              </div>

              {/* Source URL */}
              <div>
                <Label
                  htmlFor="sourceUrl"
                  className="text-[12px] sm:text-xs font-semibold uppercase tracking-wider text-[#dbc9b5]"
                >
                  Source URL
                </Label>
                <Input
                  id="sourceUrl"
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://…"
                  className="mt-1 rounded-full border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] px-3.5 text-[13px] sm:text-sm text-[#fff3e0] placeholder:text-[#968677] focus:border-[#f0788a]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Pinned Sticky Footer */}
        <DialogFooter className="px-4 sm:px-8 py-2.5 sm:py-3 border-t border-[rgba(255,243,224,0.08)] bg-[rgba(25,18,19,0.98)] backdrop-blur-md flex flex-row items-center justify-between gap-2.5 w-full shrink-0 z-30">
          {!isEditing ? (
            <div className="flex items-center justify-end gap-2.5 sm:gap-3 w-full">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="rounded-full border-[rgba(255,243,224,0.12)] bg-[rgba(255,243,224,0.04)] px-4 sm:px-5 text-xs sm:text-sm text-[#dbc9b5] hover:bg-[rgba(255,243,224,0.08)] hover:text-[#fff3e0] active:scale-95"
              >
                Close
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="rounded-full bg-[#f0788a] px-5 sm:px-6 text-xs sm:text-sm font-semibold text-white shadow-[0_0_16px_rgba(240,120,138,0.3)] hover:brightness-110 active:scale-95"
              >
                Edit entry
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={remove}
                className="rounded-full text-xs sm:text-sm text-[#e02e2a] hover:bg-[rgba(224,46,42,0.15)] hover:text-[#e02e2a] active:scale-95 px-3 sm:px-4"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
              </Button>
              <div className="flex items-center gap-2 sm:gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="rounded-full border-[rgba(255,243,224,0.12)] bg-[rgba(255,243,224,0.04)] px-4 sm:px-5 text-xs sm:text-sm text-[#dbc9b5] hover:bg-[rgba(255,243,224,0.08)] hover:text-[#fff3e0] active:scale-95"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={save}
                  className="rounded-full bg-[#f0788a] px-5 sm:px-6 text-xs sm:text-sm font-semibold text-white shadow-[0_0_16px_rgba(240,120,138,0.3)] hover:brightness-110 active:scale-95"
                >
                  Save changes
                </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
