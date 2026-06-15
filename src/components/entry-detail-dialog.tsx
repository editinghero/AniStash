import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  ALL_STATUSES,
  statusLabels,
  type LibraryEntry,
  type ListStatus,
} from "@/lib/types";
import { deleteEntry, updateEntry } from "@/lib/repo/library";
import { cn } from "@/lib/utils";
import { ExternalLink, Trash2, Star, Calendar } from "lucide-react";
import { toast } from "sonner";
import { CardAIChat } from "./card-ai-chat";

const statusRing: Record<ListStatus, string> = {
  WATCHING: "ring-status-watching/50 bg-status-watching/15 text-status-watching",
  COMPLETED: "ring-status-completed/50 bg-status-completed/15 text-status-completed",
  PLANNING: "ring-status-planning/50 bg-status-planning/15 text-status-planning",
  ON_HOLD: "ring-status-hold/50 bg-status-hold/15 text-status-hold",
  DROPPED: "ring-status-dropped/50 bg-status-dropped/15 text-status-dropped",
};

function toDateInput(ms?: number) {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fromDateInput(v: string): number | undefined {
  if (!v) return undefined;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : undefined;
}

export function EntryDetailDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: LibraryEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [status, setStatus] = useState<ListStatus>("PLANNING");
  const [progress, setProgress] = useState<string>("0");
  const [userScore, setUserScore] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [startedAt, setStartedAt] = useState<string>("");
  const [finishedAt, setFinishedAt] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setStatus(entry.status);
    setProgress(String(entry.progress ?? 0));
    setUserScore(entry.userScore != null ? String(entry.userScore) : "");
    setNotes(entry.notes ?? "");
    setStartedAt(toDateInput(entry.startedAt));
    setFinishedAt(toDateInput(entry.finishedAt));
    setIsEditing(false);
  }, [entry, open]);

  function handleCancelEdit() {
    if (entry) {
      setStatus(entry.status);
      setProgress(String(entry.progress ?? 0));
      setUserScore(entry.userScore != null ? String(entry.userScore) : "");
      setNotes(entry.notes ?? "");
      setStartedAt(toDateInput(entry.startedAt));
      setFinishedAt(toDateInput(entry.finishedAt));
    }
    setIsEditing(false);
  }

  if (!entry) return null;

  const isManga = entry.type === "MANGA";
  const isSeries = entry.type === "SERIES";
  const labels = statusLabels(entry.type);
  const total = isManga ? entry.chapters : isSeries ? undefined : entry.episodes;
  const unit = isManga ? "chapters" : isSeries ? "episodes" : "episodes";
  const anilistScore =
    entry.averageScore != null ? (entry.averageScore / 10).toFixed(1) : null;

  function save() {
    const score = userScore === "" ? undefined : Math.max(0, Math.min(10, Number(userScore)));
    const prog = progress === "" ? 0 : Math.max(0, Number(progress));
    updateEntry(entry!.id, {
      status,
      progress: Number.isFinite(prog) ? prog : 0,
      userScore: score != null && Number.isFinite(score) ? score : undefined,
      notes: notes.trim() || undefined,
      startedAt: fromDateInput(startedAt),
      finishedAt: fromDateInput(finishedAt),
    });
    toast.success("Saved");
    onOpenChange(false);
  }

  function remove() {
    if (!confirm(`Remove "${entry!.title}" from your library?`)) return;
    deleteEntry(entry!.id);
    toast.success("Removed");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0 border-border/60 bg-gradient-card">
        {/* Banner */}
        <div className="relative h-32 sm:h-40 w-full overflow-hidden bg-surface">
          {entry.bannerImage ? (
            <img
              src={entry.bannerImage}
              alt=""
              className="h-full w-full object-cover opacity-70"
            />
          ) : (
            <div className="h-full w-full bg-gradient-accent opacity-30" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
        </div>

        <div className="relative -mt-16 sm:-mt-20 px-5 sm:px-6 pb-5 sm:pb-6 max-h-[75vh] overflow-y-auto">
          <div className="flex gap-4">
            <div className="h-28 w-20 sm:h-36 sm:w-24 flex-none overflow-hidden rounded-lg ring-2 ring-border bg-surface shadow-card">
              {entry.coverImage ? (
                <img
                  src={entry.coverImage}
                  alt={entry.title}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex-1 min-w-0 pt-12 sm:pt-16">
              <DialogHeader className="text-left space-y-1">
                <DialogTitle className="font-display text-lg sm:text-xl leading-tight line-clamp-2">
                  {entry.englishTitle || entry.title}
                </DialogTitle>
                {entry.title && entry.englishTitle && entry.title !== entry.englishTitle && (
                  <DialogDescription className="text-xs line-clamp-1">
                    {entry.title}
                  </DialogDescription>
                )}
              </DialogHeader>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                {entry.format && <span>{entry.format}</span>}
                {total != null && <span>· {total} {unit}</span>}
                {anilistScore && (
                  <span className="inline-flex items-center gap-1 text-status-planning">
                    <Star className="h-3 w-3 fill-status-planning" /> {anilistScore} AniList
                  </span>
                )}
              </div>
            </div>
          </div>

          {entry.genres && entry.genres.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {entry.genres.slice(0, 6).map((g) => (
                <span
                  key={g}
                  className="rounded-full bg-surface/80 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border/60"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {entry.description && (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground line-clamp-4">
              {entry.description}
            </p>
          )}

          {!isEditing ? (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Status */}
                <div className="rounded-xl bg-surface/40 p-3 ring-1 ring-border/60">
                  <span className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground block mb-1">
                    Status
                  </span>
                  <span className={cn(
                    "inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1",
                    statusRing[status]
                  )}>
                    {labels[status]}
                  </span>
                </div>

                {/* Progress */}
                <div className="rounded-xl bg-surface/40 p-3 ring-1 ring-border/60">
                  <span className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground block mb-1">
                    Progress
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    {progress || "0"} {total != null ? `/ ${total}` : ""} {unit}
                  </span>
                </div>

                {/* Score */}
                <div className="rounded-xl bg-surface/40 p-3 ring-1 ring-border/60">
                  <span className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground block mb-1">
                    Your Score
                  </span>
                  <span className="text-xs font-semibold text-foreground inline-flex items-center gap-1">
                    {userScore !== "" ? (
                      <>
                        <Star className="h-3.5 w-3.5 fill-status-planning text-status-planning" />
                        {Number(userScore).toFixed(1)}/10
                      </>
                    ) : (
                      <span className="text-muted-foreground font-normal text-[11px]">Unrated</span>
                    )}
                  </span>
                </div>

                {/* Timeline */}
                <div className="rounded-xl bg-surface/40 p-3 ring-1 ring-border/60 col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground block mb-1">
                    Timeline
                  </span>
                  <div className="text-[10px] space-y-0.5 text-foreground/90 font-medium leading-tight">
                    {startedAt ? (
                      <div>Started: {new Date(startedAt + "T00:00:00").toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</div>
                    ) : null}
                    {finishedAt ? (
                      <div>Finished: {new Date(finishedAt + "T00:00:00").toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</div>
                    ) : null}
                    {!startedAt && !finishedAt && (
                      <span className="text-muted-foreground text-[11px] font-normal">No dates</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {notes && (
                <div className="rounded-xl bg-surface/30 p-4 ring-1 ring-border/60 space-y-1.5">
                  <span className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground block">
                    Personal Notes
                  </span>
                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                    {notes}
                  </p>
                </div>
              )}

              {/* Bookmark Link */}
              {entry.sourceUrl && (
                <a
                  href={entry.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground pt-1"
                >
                  <ExternalLink className="h-3 w-3" /> Source bookmark
                </a>
              )}
              
              {/* AI Chat */}
              <CardAIChat entry={entry} />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status pills */}
              <div className="mt-5">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Status
                </Label>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {ALL_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={cn(
                        "rounded-lg px-2 py-1.5 text-[11px] font-semibold ring-1 transition-all",
                        status === s
                          ? `${statusRing[s]} ring-2`
                          : "bg-surface/40 text-muted-foreground ring-border/60 hover:text-foreground hover:bg-surface",
                      )}
                    >
                      {labels[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress + score */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="progress" className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Progress {total != null && <span className="normal-case opacity-70">/ {total}</span>}
                  </Label>
                  <Input
                    id="progress"
                    type="number"
                    min={0}
                    max={total ?? undefined}
                    value={progress}
                    onChange={(e) => setProgress(e.target.value)}
                    className="mt-1.5 bg-surface"
                  />
                </div>
                <div>
                  <Label htmlFor="score" className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Your score <span className="normal-case opacity-70">/ 10</span>
                  </Label>
                  <Input
                    id="score"
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    placeholder="—"
                    value={userScore}
                    onChange={(e) => setUserScore(e.target.value)}
                    className="mt-1.5 bg-surface"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="started" className="text-[11px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Started
                  </Label>
                  <Input
                    id="started"
                    type="date"
                    value={startedAt}
                    onChange={(e) => setStartedAt(e.target.value)}
                    className="mt-1.5 bg-surface"
                  />
                </div>
                <div>
                  <Label htmlFor="finished" className="text-[11px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Finished
                  </Label>
                  <Input
                    id="finished"
                    type="date"
                    value={finishedAt}
                    onChange={(e) => setFinishedAt(e.target.value)}
                    className="mt-1.5 bg-surface"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="mt-4">
                <Label htmlFor="notes" className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder="Thoughts, quotes, who recommended it…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1.5 bg-surface resize-none"
                />
              </div>

              {entry.sourceUrl && (
                <a
                  href={entry.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" /> Source bookmark
                </a>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 border-t border-border/60 bg-card/80 px-5 sm:px-6 py-3 backdrop-blur">
          {!isEditing ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="ml-auto">
                Close
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="bg-gradient-accent text-white hover:opacity-95"
              >
                Edit entry
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={remove}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-1.5" /> Remove
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={save}
                className="bg-gradient-accent text-white hover:opacity-95"
              >
                Save changes
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}