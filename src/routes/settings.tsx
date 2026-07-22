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
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { rpc } from "@/lib/rpc";
import { refreshLibrary } from "@/lib/repo/library";
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

function isTransferEntry(value: unknown): value is TransferEntry {
  if (!isRecord(value)) return false;
  const types: MediaType[] = ["ANIME", "MANGA", "SERIES"];
  const statuses: ListStatus[] = [
    "WATCHING",
    "COMPLETED",
    "PLANNING",
    "ON_HOLD",
    "DROPPED",
  ];
  return (
    types.includes(value.type as MediaType) &&
    statuses.includes(value.status as ListStatus) &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    value.title.length <= 500 &&
    isOptionalNumber(value.anilistId) &&
    isOptionalNumber(value.malId) &&
    [
      value.englishTitle,
      value.nativeTitle,
      value.coverImage,
      value.bannerImage,
      value.format,
      value.ageRating,
      value.description,
      value.notes,
    ].every(isOptionalString) &&
    isOptionalHttpUrl(value.sourceUrl) &&
    [
      value.episodes,
      value.chapters,
      value.averageScore,
      value.progress,
      value.userScore,
      value.startedAt,
      value.finishedAt,
    ].every(isOptionalNumber) &&
    (value.genres === undefined ||
      (Array.isArray(value.genres) &&
        value.genres.every((genre) => typeof genre === "string")))
  );
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
    rpc.api.settings
      .$get()
      .then((res) => res.json())
      .then((s) => {
        setApiKey(s.geminiApiKey ?? "");
        setModel(s.geminiModel ?? DEFAULT_GEMINI_MODEL);
      })
      .catch(() => {
        toast.error("Failed to load settings");
      });
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await rpc.api.settings.$post({
        json: {
          geminiApiKey: apiKey.trim() || undefined,
          geminiModel: model.trim() || DEFAULT_GEMINI_MODEL,
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
          "There are no library entries in this database to export. Localhost uses its own local database.",
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
      const parsed: unknown = JSON.parse(await file.text());
      if (
        !isRecord(parsed) ||
        parsed.format !== "anistash-library" ||
        parsed.version !== 1 ||
        !Array.isArray(parsed.entries) ||
        parsed.entries.length > MAX_IMPORT_ENTRIES ||
        !parsed.entries.every(isTransferEntry)
      ) {
        throw new Error("This is not a valid AniStash library backup");
      }

      const res = await rpc.api.library.$get();
      if (!res.ok) throw new Error("Please sign in before importing a library");
      const existing = (await res.json()) as LibraryEntry[];
      const existingKeys = new Set(existing.map(entryKey));
      const uniqueEntries: TransferEntry[] = [];
      let skipped = 0;
      for (const entry of parsed.entries) {
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
          "No new entries to import; all entries are already in your library",
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
    <main className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <header>
        <h1 className="font-display text-3xl md:text-4xl font-bold">
          Settings
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          AniStash uses your own Google Gemini key for bookmark title
          extraction. It is stored encrypted at rest in the database and is
          decrypted only when querying Gemini.
        </p>
      </header>

      <form
        onSubmit={onSave}
        className="space-y-5 rounded-2xl bg-gradient-card p-6 ring-1 ring-border/60 shadow-card"
      >
        <div>
          <Label
            htmlFor="key"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground"
          >
            <KeyRound className="h-3 w-3" /> Gemini API key
          </Label>
          <Input
            id="key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza…"
            className="mt-2 bg-surface"
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Get one free at{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              aistudio.google.com/apikey
            </a>
            . Stored securely and encrypted at rest in your database.
          </p>
        </div>

        <div>
          <Label
            htmlFor="model"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground"
          >
            <Sparkles className="h-3 w-3" /> Model ID
          </Label>
          <Input
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={DEFAULT_GEMINI_MODEL}
            className="mt-2 bg-surface font-mono text-sm"
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            e.g. <code>gemini-2.5-flash</code>, <code>gemini-3.5-flash</code>,{" "}
            <code>gemma-4-31b-it</code>.
          </p>
        </div>

        <Button
          type="submit"
          className="w-full bg-gradient-accent text-white hover:opacity-95"
        >
          Save
        </Button>
      </form>

      <section className="space-y-5 rounded-2xl bg-gradient-card p-6 ring-1 ring-border/60 shadow-card">
        <div>
          <h2 className="inline-flex items-center gap-2 font-display text-xl font-semibold">
            <LockKeyhole className="h-5 w-5 text-primary" /> Local app PIN
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Add a 4-digit PIN before this browser opens your library. It is
            stored only in this browser as a protected hash—never in AniStash or
            your database. Three incorrect attempts sign you out and remove it
            automatically.
          </p>
        </div>

        <form onSubmit={saveLocalPin} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="local-pin">New 4-digit PIN</Label>
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
                className="mt-2 bg-surface text-center font-mono text-lg tracking-[0.45em]"
                placeholder="••••"
              />
            </div>
            <div>
              <Label htmlFor="confirm-local-pin">Confirm PIN</Label>
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
                className="mt-2 bg-surface text-center font-mono text-lg tracking-[0.45em]"
                placeholder="••••"
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="submit"
              disabled={isSavingPin}
              className="min-h-11 flex-1 bg-gradient-accent text-white"
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
                className="min-h-11 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={removeLocalPin}
              >
                Remove PIN
              </Button>
            )}
          </div>
        </form>
        <p className="rounded-xl bg-surface/60 p-3 text-xs leading-5 text-muted-foreground">
          This is a privacy lock for this device, not a replacement for your
          account password. If you forget it, clear this browser&apos;s AniStash
          site data and sign in again.
        </p>
      </section>

      <section className="space-y-5 rounded-2xl bg-gradient-card p-6 ring-1 ring-border/60 shadow-card">
        <div>
          <h2 className="inline-flex items-center gap-2 font-display text-xl font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" /> Library backup
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Export contains only your library entries. It never includes your
            API key, password, session, or other account settings. Imports add
            only new entries and skip duplicates; they never delete your
            existing library.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            onClick={exportLibrary}
            className="hover:bg-surface hover:text-foreground"
          >
            <Download /> Export library
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="hover:bg-surface hover:text-foreground"
          >
            <Upload /> Import library
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => void selectImportFile(event.target.files?.[0])}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Backups must be AniStash JSON files with at most {MAX_IMPORT_ENTRIES}{" "}
          entries and a 5 MB size limit.
        </p>
      </section>

      <AlertDialog
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open && !isImporting) setPendingImport(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import library backup?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingImport?.length ?? 0} new entries will be added.
              {skippedEntries > 0
                ? ` ${skippedEntries} duplicate ${skippedEntries === 1 ? "entry will" : "entries will"} be skipped.`
                : " No existing entries will be changed or deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isImporting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isImporting} onClick={importLibrary}>
              {isImporting ? "Importing…" : "Import safely"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
