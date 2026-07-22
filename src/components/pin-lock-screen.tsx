import { useEffect, useRef, useState } from "react";
import { KeyRound, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyLocalPin } from "@/lib/local-pin";

type PinLockScreenProps = {
  userId: string;
  onUnlocked: () => void;
  onLockout: () => Promise<boolean>;
};

export function PinLockScreen({
  userId,
  onUnlocked,
  onLockout,
}: PinLockScreenProps) {
  const [pin, setPin] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Unlock AniStash";
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pin.length !== 4 || isChecking) return;

    setIsChecking(true);
    setError("");
    try {
      if (await verifyLocalPin(userId, pin)) {
        onUnlocked();
        return;
      }

      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      setPin("");
      if (nextAttempts >= 3) {
        const loggedOut = await onLockout();
        if (!loggedOut) {
          setError("Could not sign out. Check your connection and try again.");
        }
      } else {
        setError(
          `That PIN is not correct. ${3 - nextAttempts} attempt${3 - nextAttempts === 1 ? "" : "s"} remaining.`,
        );
      }
    } catch {
      setError("Unable to verify your PIN. Please try again.");
    } finally {
      setIsChecking(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-background bg-hero px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,hsl(var(--primary)/0.16),transparent_32rem)]" />
      <section className="relative w-full max-w-xs rounded-[1.75rem] bg-gradient-card p-5 shadow-card ring-1 ring-border/70 sm:p-6">
        <header className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#181422] shadow-glow ring-1 ring-primary/20">
            <span className="font-display text-3xl font-bold bg-gradient-to-r from-[#ff604b] to-[#ff4ebb] bg-clip-text text-transparent">
              愛
            </span>
          </div>
          <p className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-primary">
            <LockKeyhole className="h-3.5 w-3.5" /> Local app lock
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            Welcome back
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Enter your 4-digit PIN to open AniStash.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <label htmlFor="app-pin" className="sr-only">
            Four-digit app PIN
          </label>
          <div className="relative h-14 sm:h-15">
            <input
              ref={inputRef}
              id="app-pin"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              onChange={(event) => {
                setPin(event.target.value.replace(/\D/g, "").slice(0, 4));
                setError("");
              }}
              className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
              aria-describedby={error ? "pin-error" : undefined}
              aria-invalid={Boolean(error)}
            />
            <div
              className="pointer-events-none grid h-full grid-cols-4 gap-2.5 sm:gap-3"
              aria-hidden="true"
            >
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className={`grid place-items-center rounded-2xl border bg-surface/80 text-2xl font-bold transition-all duration-200 motion-reduce:transition-none ${
                    pin[index]
                      ? "border-primary/70 bg-primary/10 text-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.08)]"
                      : "border-border/70 text-muted-foreground"
                  }`}
                >
                  {pin[index] ? "•" : ""}
                </div>
              ))}
            </div>
          </div>

          <p
            id="pin-error"
            role="alert"
            className="min-h-5 text-center text-sm text-destructive"
          >
            {error}
          </p>

          <Button
            type="submit"
            disabled={isChecking || pin.length !== 4}
            className="min-h-11 w-full bg-gradient-accent text-white shadow-glow transition-transform active:scale-[0.98] motion-reduce:transition-none"
          >
            {isChecking ? "Checking…" : "Unlock library"}
          </Button>
        </form>

        <p className="mt-6 flex items-start gap-2 rounded-xl bg-surface/60 p-3 text-xs leading-5 text-muted-foreground">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          After three incorrect attempts, you will be signed out and this local
          PIN will be removed.
        </p>
      </section>
    </main>
  );
}
