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
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#191213] px-4 py-8">
      <section className="relative w-full max-w-xs rounded-3xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.92)] p-6 shadow-[0_16px_50px_rgba(0,0,0,0.7)] backdrop-blur-2xl sm:p-7">
        <header className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(240,120,138,0.4)] bg-[#22191a] shadow-[0_0_20px_rgba(240,120,138,0.25)]">
            <span className="font-display text-2xl font-bold text-[#f0788a]">
              愛
            </span>
          </div>
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#f0788a]">
            <LockKeyhole className="h-3.5 w-3.5" /> Local app lock
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-[#fff3e0]">
            Welcome back
          </h1>
          <p className="mt-1 text-xs text-[#968677]">
            Enter your 4-digit PIN to open your stash.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label htmlFor="app-pin" className="sr-only">
            Four-digit app PIN
          </label>
          <div className="relative h-13 sm:h-14">
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
              className="pointer-events-none grid h-full grid-cols-4 gap-2.5"
              aria-hidden="true"
            >
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className={`grid place-items-center rounded-2xl border text-xl font-bold transition-all duration-200 ${
                    pin[index]
                      ? "border-[#f0788a] bg-[rgba(240,120,138,0.15)] text-[#f0788a] shadow-[0_0_12px_rgba(240,120,138,0.25)]"
                      : "border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] text-[#968677]"
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
            className="min-h-4 text-center text-xs text-[#e02e2a]"
          >
            {error}
          </p>

          <Button
            type="submit"
            disabled={isChecking || pin.length !== 4}
            className="w-full rounded-full bg-[#f0788a] py-3 text-xs sm:text-sm font-semibold text-[#191213] shadow-[0_0_20px_rgba(240,120,138,0.3)] hover:brightness-110 active:scale-95 disabled:opacity-40 transition-all"
          >
            {isChecking ? "Checking…" : "Unlock library"}
          </Button>
        </form>

        <p className="mt-5 flex items-start gap-1.5 rounded-2xl border border-[rgba(255,243,224,0.06)] bg-[rgba(255,243,224,0.02)] p-2.5 text-[11px] leading-relaxed text-[#968677]">
          <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f0788a]" />
          <span>After three incorrect attempts, you will be signed out automatically.</span>
        </p>
      </section>
    </main>
  );
}
