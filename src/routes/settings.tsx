import { Link, useDocumentMetadata, useRouteContext } from "@/lib/router";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Download,
  KeyRound,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Sparkles,
  Tag,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { rpc } from "@/lib/rpc";
import { refreshLibrary } from "@/lib/repo/library";
import {
  addCategory,
  deleteCategory,
  getCategories,
  subscribeCategories,
} from "@/lib/categories";
import {
  clearLocalPin,
  hasLocalPinForUser,
  setLocalPin,
} from "@/lib/local-pin";
import type { LibraryEntry, ListStatus, MediaType } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_ENTRIES = 200;

type TransferEntry = Omit<LibraryEntry, "id" | "createdAt" | "updatedAt">;

type LibraryBackup = {
  format: "anistash-library";
  version: 1;
  exportedAt: string;
  entries: TransferEntry[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "number";
}

function isOptionalHttpUrl(value: unknown): boolean {
  if (!isOptionalString(value)) return false;
  if (!value) return true;
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeTransferEntry(raw: any): TransferEntry | null {
  if (!raw || typeof raw !== "object") return null;

  const rawType = String(raw.type || "ANIME").toUpperCase();
  const type: MediaType = rawType === "MANGA" || rawType === "SERIES" ? rawType : "ANIME";

  const rawStatus = String(raw.status || "PLANNING").toUpperCase();
  const validStatuses: ListStatus[] = ["WATCHING", "COMPLETED", "PLANNING", "ON_HOLD", "DROPPED"];
  const status: ListStatus = validStatuses.includes(rawStatus as ListStatus)
    ? (rawStatus as ListStatus)
    : "PLANNING";

  const title = String(raw.title || "").trim();
  if (!title) return null;

  const toOptNum = (v: any) => {
    if (v === null || v === undefined || v === "") return undefined;
    const n = Number(v);
    return isNaN(n) ? undefined : n;
  };

  const toOptStr = (v: any) => {
    if (v === null || v === undefined) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
  };

  return {
    type,
    status,
    title,
    anilistId: toOptNum(raw.anilistId),
    malId: toOptNum(raw.malId),
    englishTitle: toOptStr(raw.englishTitle),
    nativeTitle: toOptStr(raw.nativeTitle),
    coverImage: toOptStr(raw.coverImage),
    bannerImage: toOptStr(raw.bannerImage),
    format: toOptStr(raw.format),
    episodes: toOptNum(raw.episodes),
    chapters: toOptNum(raw.chapters),
    averageScore: toOptNum(raw.averageScore),
    ageRating: toOptStr(raw.ageRating),
    description: toOptStr(raw.description),
    notes: toOptStr(raw.notes),
    sourceUrl: toOptStr(raw.sourceUrl),
    progress: toOptNum(raw.progress),
    userScore: toOptNum(raw.userScore),
    startedAt: toOptNum(raw.startedAt),
    finishedAt: toOptNum(raw.finishedAt),
    genres: Array.isArray(raw.genres)
      ? raw.genres.map(String).filter((g: string) => g.length > 0)
      : undefined,
    categories: Array.isArray(raw.categories)
      ? raw.categories.map(String).filter((c: string) => c.length > 0)
      : undefined,
  };
}

function entryKey(entry: Pick<LibraryEntry, "type" | "anilistId" | "title">) {
  return entry.anilistId != null
    ? `${entry.type}:anilist:${entry.anilistId}`
    : `${entry.type}:title:${entry.title.trim().toLocaleLowerCase()}`;
}

export default function SettingsPage() {
  useDocumentMetadata(
    "Settings — AniStash",
    "Configure your Gemini API key and model.",
  );
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(DEFAULT_GEMINI_MODEL);
  const [categories, setCategories] = useState<string[]>(() => getCategories());
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [pendingImport, setPendingImport] = useState<TransferEntry[] | null>(
    null,
  );
  const [skippedEntries, setSkippedEntries] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useRouteContext({ from: "__root__" }) as {
    user: { id: string };
  };
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [hasPin, setHasPin] = useState(() => hasLocalPinForUser(user.id));

  useEffect(() => {
    setCategories(getCategories());
    return subscribeCategories(() => {
      setCategories([...getCategories()]);
    });
  }, []);

  useEffect(() => {
    rpc.api.settings
      .$get()
      .then((res) => res.json())
      .then((s: Record<string, any>) => {
        setApiKey(s.geminiApiKey ?? "");
        setModel(s.geminiModel ?? DEFAULT_GEMINI_MODEL);
      })
      .catch(() => {
        toast.error("Failed to load settings");
      });
  }, []);

  function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    const val = newCategoryInput.trim();
    if (!val) return;
    if (addCategory(val)) {
      toast.success(`Added category "${val}"`);
      setNewCategoryInput("");
    } else {
      toast.error("Category already exists or invalid");
    }
  }

  function handleDeleteCategory(cat: string) {
    if (deleteCategory(cat)) {
      toast.success(`Removed category "${cat}"`);
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await rpc.api.settings.$post({
        json: {
          geminiApiKey: apiKey.trim() || undefined,
          geminiModel: model.trim() || undefined,
        },
      });
      if (!res.ok) throw new Error("Failed to save settings");
      toast.success("Settings saved to database");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save settings",
      );
    }
  }

  async function saveLocalPin(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{4}$/.test(newPin)) {
      toast.error("Choose a PIN with exactly 4 digits");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("The PINs do not match");
      return;
    }

    setIsSavingPin(true);
    try {
      await setLocalPin(user.id, newPin);
      setNewPin("");
      setConfirmPin("");
      setHasPin(true);
      toast.success("Local app PIN enabled");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the local PIN",
      );
    } finally {
      setIsSavingPin(false);
    }
  }

  function removeLocalPin() {
    clearLocalPin(user.id);
    setHasPin(false);
    setNewPin("");
    setConfirmPin("");
    toast.success("Local app PIN removed");
  }

  async function exportLibrary() {
    try {
      const res = await rpc.api.library.$get();
      if (!res.ok) {
        throw new Error("Please sign in before exporting your library");
      }
      const entries = (await res.json()) as LibraryEntry[];
      if (entries.length === 0) {
        toast.info(
          "There are no library entries in this database to export.",
        );
        return;
      }
      const backup: LibraryBackup = {
        format: "anistash-library",
        version: 1,
        exportedAt: new Date().toISOString(),
        entries: entries.map(({ id, createdAt, updatedAt, ...entry }) => entry),
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `anistash-library-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${entries.length} library entries`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to export library",
      );
    }
  }

  async function selectImportFile(file?: File) {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      toast.error("Import files must be 5 MB or smaller");
      return;
    }

    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);

      let rawEntriesList: any[] = [];
      if (Array.isArray(parsed)) {
        rawEntriesList = parsed;
      } else if (isRecord(parsed) && Array.isArray((parsed as any).entries)) {
        rawEntriesList = (parsed as any).entries;
      } else {
        throw new Error("Invalid JSON structure: expected array or { entries: [...] }");
      }

      if (rawEntriesList.length === 0) {
        toast.info("The selected file does not contain any library entries.");
        return;
      }

      const normalizedEntries: TransferEntry[] = [];
      for (const item of rawEntriesList) {
        const norm = normalizeTransferEntry(item);
        if (norm) normalizedEntries.push(norm);
      }

      if (normalizedEntries.length === 0) {
        throw new Error("No valid entries found in the file.");
      }

      const res = await rpc.api.library.$get();
      if (!res.ok) throw new Error("Please sign in before importing a library");
      const existing = (await res.json()) as LibraryEntry[];
      const existingKeys = new Set(existing.map(entryKey));
      const uniqueEntries: TransferEntry[] = [];
      let skipped = 0;

      for (const entry of normalizedEntries) {
        const key = entryKey(entry);
        if (existingKeys.has(key)) {
          skipped++;
        } else {
          existingKeys.add(key);
          uniqueEntries.push(entry);
        }
      }

      if (uniqueEntries.length === 0) {
        toast.info(
          "All entries in this file are already in your library",
        );
        return;
      }

      setSkippedEntries(skipped);
      setPendingImport(uniqueEntries);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not read the import file",
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function importLibrary() {
    if (!pendingImport) return;
    setIsImporting(true);
    try {
      for (const entry of pendingImport) {
        const res = await rpc.api.library.upsert.$post({ json: entry });
        if (!res.ok) throw new Error("The import could not be completed");
      }
      await refreshLibrary();
      toast.success(
        `Imported ${pendingImport.length} new ${pendingImport.length === 1 ? "entry" : "entries"}${skippedEntries ? `; skipped ${skippedEntries} duplicate${skippedEntries === 1 ? "" : "s"}` : ""}`,
      );
      setPendingImport(null);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `${err.message}. Existing entries were not deleted.`
          : "Import failed. Existing entries were not deleted.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-3 sm:px-4 py-4 sm:py-8 space-y-6 animate-page-in">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#dbc9b5] hover:text-[#fff3e0] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <header>
        <h1 className="font-display text-2xl sm:text-4xl font-bold text-[#fff3e0]">
          Settings
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[#968677]">
          AniStash uses your own Google Gemini key for bookmark title
          extraction. Stored encrypted at rest in your database.
        </p>
      </header>

      <form
        onSubmit={onSave}
        className="space-y-4 rounded-3xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] p-5 sm:p-7 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
      >
        <div>
          <Label
            htmlFor="key"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#dbc9b5]"
          >
            <KeyRound className="h-3.5 w-3.5 text-[#f0788a]" /> Gemini API key
          </Label>
          <Input
            id="key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza…"
            className="mt-1.5 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] px-4 text-xs sm:text-sm text-[#fff3e0] placeholder:text-[#968677] focus:border-[#f0788a]"
          />
          <p className="mt-1.5 text-[11px] text-[#968677]">
            Get one free at{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#f0788a] underline-offset-2 hover:underline"
            >
              aistudio.google.com/apikey
            </a>
            .
          </p>
        </div>

        <div>
          <Label
            htmlFor="model"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#dbc9b5]"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#f0788a]" /> Model ID
          </Label>
          <Input
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={DEFAULT_GEMINI_MODEL}
            className="mt-1.5 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] px-4 font-mono text-xs sm:text-sm text-[#fff3e0] focus:border-[#f0788a]"
          />
          <p className="mt-1.5 text-[11px] text-[#968677]">
            e.g. <code>gemini-2.5-flash</code>, <code>gemini-3.5-flash</code>.
          </p>
        </div>

        <Button
          type="submit"
          className="w-full rounded-full bg-[#f0788a] py-2.5 text-xs sm:text-sm font-semibold text-white shadow-[0_0_18px_rgba(240,120,138,0.3)] hover:brightness-110 active:scale-95 transition-all"
        >
          Save settings
        </Button>
      </form>

      <section className="space-y-4 rounded-3xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] p-5 sm:p-7 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div>
          <h2 className="inline-flex items-center gap-2 font-display text-lg sm:text-xl font-bold text-[#fff3e0]">
            <Tag className="h-4 w-4 text-[#f0788a]" /> Categories & Tags
          </h2>
          <p className="mt-1 text-xs sm:text-sm leading-relaxed text-[#968677]">
            Manage custom tags for your anime & manga filters.
          </p>
        </div>

        <form onSubmit={handleAddCategory} className="flex gap-2">
          <Input
            value={newCategoryInput}
            onChange={(e) => setNewCategoryInput(e.target.value)}
            placeholder="New category name (e.g. Thriller)..."
            className="flex-1 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] px-4 text-xs sm:text-sm text-[#fff3e0] placeholder:text-[#968677] focus:border-[#f0788a]"
          />
          <Button
            type="submit"
            className="rounded-full bg-[#f0788a] px-4 text-xs font-semibold text-white shadow-[0_0_14px_rgba(240,120,138,0.3)] shrink-0 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </form>

        <div>
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-[#dbc9b5] block mb-2">
            Your Categories ({categories.length})
          </Label>
          {categories.length === 0 ? (
            <p className="text-xs text-[#968677] italic">No categories yet. Add one above!</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <div
                  key={cat}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] px-3 py-1.5 text-xs font-medium text-[#fff3e0] backdrop-blur-md"
                >
                  <Tag className="h-3 w-3 text-[#f0788a]" />
                  <span>{cat}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat)}
                    className="ml-1 rounded-full p-0.5 text-[#968677] hover:bg-[#e02e2a]/20 hover:text-[#e02e2a] transition-colors"
                    title={`Delete category "${cat}"`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] p-5 sm:p-7 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div>
          <h2 className="inline-flex items-center gap-2 font-display text-lg sm:text-xl font-bold text-[#fff3e0]">
            <LockKeyhole className="h-4 w-4 text-[#f0788a]" /> Local app PIN
          </h2>
          <p className="mt-1 text-xs sm:text-sm leading-relaxed text-[#968677]">
            Add a 4-digit PIN for this browser. Three incorrect attempts sign you out automatically.
          </p>
        </div>

        <form onSubmit={saveLocalPin} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="local-pin" className="text-[11px] font-semibold uppercase tracking-wider text-[#dbc9b5]">New 4-digit PIN</Label>
              <Input
                id="local-pin"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={4}
                pattern="[0-9]*"
                value={newPin}
                onChange={(event) =>
                  setNewPin(event.target.value.replace(/\D/g, "").slice(0, 4))
                }
                className="mt-1.5 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] text-center font-mono text-base tracking-[0.4em] text-[#fff3e0] focus:border-[#f0788a]"
                placeholder="••••"
              />
            </div>
            <div>
              <Label htmlFor="confirm-local-pin" className="text-[11px] font-semibold uppercase tracking-wider text-[#dbc9b5]">Confirm PIN</Label>
              <Input
                id="confirm-local-pin"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={4}
                pattern="[0-9]*"
                value={confirmPin}
                onChange={(event) =>
                  setConfirmPin(
                    event.target.value.replace(/\D/g, "").slice(0, 4),
                  )
                }
                className="mt-1.5 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] text-center font-mono text-base tracking-[0.4em] text-[#fff3e0] focus:border-[#f0788a]"
                placeholder="••••"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Button
              type="submit"
              disabled={isSavingPin}
              className="flex-1 rounded-full bg-[#f0788a] py-2.5 text-xs sm:text-sm font-semibold text-white shadow-[0_0_16px_rgba(240,120,138,0.3)] hover:brightness-110 active:scale-95"
            >
              {isSavingPin
                ? "Saving…"
                : hasPin
                  ? "Update local PIN"
                  : "Enable local PIN"}
            </Button>
            {hasPin && (
              <Button
                type="button"
                variant="outline"
                className="rounded-full border border-[#e02e2a]/30 text-xs text-[#e02e2a] hover:bg-[#e02e2a]/15 hover:text-[#e02e2a]"
                onClick={removeLocalPin}
              >
                Remove PIN
              </Button>
            )}
          </div>
        </form>
      </section>

      <section className="space-y-4 rounded-3xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] p-5 sm:p-7 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div>
          <h2 className="inline-flex items-center gap-2 font-display text-lg sm:text-xl font-bold text-[#fff3e0]">
            <ShieldCheck className="h-4 w-4 text-[#f0788a]" /> Library backup
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-[#968677]">
            Export or import your AniStash library entries.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            onClick={exportLibrary}
            className="rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.03)] text-xs text-[#dbc9b5] hover:bg-[rgba(255,243,224,0.08)] hover:text-[#fff3e0] active:scale-95"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export library
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.03)] text-xs text-[#dbc9b5] hover:bg-[rgba(255,243,224,0.08)] hover:text-[#fff3e0] active:scale-95"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Import library
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => void selectImportFile(event.target.files?.[0])}
          />
        </div>
      </section>

      <AlertDialog
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open && !isImporting) setPendingImport(null);
        }}
      >
        <AlertDialogContent className="rounded-3xl border border-[rgba(255,243,224,0.09)] bg-[rgba(34,25,26,0.95)] backdrop-blur-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-lg font-bold text-[#fff3e0]">Import library backup?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#968677]">
              {pendingImport?.length ?? 0} new entries will be added.
              {skippedEntries > 0
                ? ` ${skippedEntries} duplicate ${skippedEntries === 1 ? "entry will" : "entries will"} be skipped.`
                : " No existing entries will be changed or deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isImporting} className="rounded-full border-[rgba(255,243,224,0.08)] text-xs text-[#dbc9b5]">Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isImporting} onClick={importLibrary} className="rounded-full bg-[#f0788a] text-xs font-semibold text-white shadow-[0_0_12px_rgba(240,120,138,0.3)]">
              {isImporting ? "Importing…" : "Import safely"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
