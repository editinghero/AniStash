import { Link, useDocumentMetadata } from "@/lib/router";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft, KeyRound, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { rpc } from "@/lib/rpc";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export default function SettingsPage() {
  useDocumentMetadata(
    "Settings — AniStash",
    "Configure your Gemini API key and model."
  );
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(DEFAULT_GEMINI_MODEL);

  useEffect(() => {
    rpc.api.settings.$get()
      .then(res => res.json())
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
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
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
        <h1 className="font-display text-3xl md:text-4xl font-bold">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          AniStash uses your own Google Gemini key for bookmark title extraction.
          It is stored encrypted at rest in the database and is decrypted only when querying Gemini.
        </p>
      </header>

      <form
        onSubmit={onSave}
        className="space-y-5 rounded-2xl bg-gradient-card p-6 ring-1 ring-border/60 shadow-card"
      >
        <div>
          <Label htmlFor="key" className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
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
          <Label htmlFor="model" className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
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
            e.g. <code>gemini-2.5-flash</code>, <code>gemini-2.5-pro</code>, <code>gemini-2.0-flash</code>.
          </p>
        </div>

        <Button
          type="submit"
          className="w-full bg-gradient-accent text-primary-foreground hover:opacity-95"
        >
          Save
        </Button>
      </form>
    </main>
  );
}