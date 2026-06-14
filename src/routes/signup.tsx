import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, Mail, User, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const getSignupStatus = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const { isSignupAllowed } = await import("@/lib/auth");
      const allowed = await isSignupAllowed();
      console.log("[getSignupStatus] Returning allowed:", allowed);
      return { allowed };
    } catch (error) {
      console.error("[getSignupStatus] Error:", error);
      // Default to true on error (dev mode)
      return { allowed: true };
    }
  });

export const signupUser = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      displayName: z.string().min(2).max(50),
      email: z.string().email(),
      password: z.string().min(6),
    }),
  )
  .handler(async ({ data }) => {
    try {
      // CRITICAL: Check signup permission FIRST before any processing
      const { isSignupAllowed, createSession } = await import("@/lib/auth");
      const allowed = await isSignupAllowed();
      
      if (!allowed) {
        console.warn("[SIGNUP BLOCKED] Attempt to signup with email:", data.email);
        throw new Error("Signups are currently disabled on this instance.");
      }

      const { getDB } = await import("@/lib/db");
      const db = await getDB();
      const existing = await db
        .prepare("SELECT id FROM users WHERE email = ?")
        .bind(data.email.toLowerCase().trim())
        .first();

      if (existing) {
        throw new Error("An account with this email already exists.");
      }

      const { hashPassword } = await import("@/lib/crypto");
      const userId = crypto.randomUUID();
      const passHash = await hashPassword(data.password);
      const now = Date.now();

      // Create user
      await db
        .prepare(
          "INSERT INTO users (id, email, email_verified, display_name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(userId, data.email.toLowerCase().trim(), 1, data.displayName.trim(), passHash, now, now)
        .run();

      // Create default settings
      await db
        .prepare(
          "INSERT INTO user_settings (user_id, gemini_model, theme, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(userId, "gemini-2.5-flash", "dark", now, now)
        .run();

      const { token, expiresAt } = await createSession(userId);

      const httpMod = "vinxi/http";
      const { setResponseHeader } = await import(httpMod);
      const isDev = process.env.NODE_ENV === "development";
      setResponseHeader(
        "Set-Cookie",
        `anistash_session=${token}; Path=/; HttpOnly; SameSite=Lax${isDev ? "" : "; Secure"}; Expires=${new Date(expiresAt).toUTCString()}`,
      );

      return { success: true };
    } catch (error) {
      console.error("[SIGNUP ERROR]", error);
      
      // Provide helpful error message
      if (error instanceof Error) {
        if (error.message.includes("D1 database binding")) {
          throw new Error("Database not available. Please run: npx wrangler d1 execute anistash --file=./schema.d1.sql --local");
        }
        throw error;
      }
      throw new Error("Failed to create account. Please try again.");
    }
  });

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — AniStash" },
      { name: "description", content: "Create an account on AniStash." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [allowed, setAllowed] = useState<boolean>(true); // Default to true

  useEffect(() => {
    getSignupStatus()
      .then((res) => {
        console.log("[Signup Page] Signup status:", res.allowed);
        setAllowed(res.allowed);
      })
      .catch((err) => {
        console.error("[Signup Page] Failed to get signup status:", err);
        setAllowed(true); // fallback to enabled if fetch fails
      });
  }, []);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim() || !email.trim() || !password.trim()) return;

    setLoading(true);
    try {
      await signupUser({ data: { displayName, email, password } });
      toast.success("Account created successfully!");
      window.location.href = "/";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to register account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-20">
      <div className="space-y-6 rounded-3xl bg-gradient-card p-8 ring-1 ring-border/60 shadow-card">
        <header className="text-center space-y-2">
          <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-gradient-accent shadow-glow font-display text-xl font-bold text-primary-foreground">
            鬼
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Create an AniStash Account
          </h1>
          <p className="text-xs text-muted-foreground">
            Start stashing and tracking your anime & manga lists
          </p>
        </header>

        {allowed === false ? (
          <div className="rounded-xl border border-dashed border-status-dropped bg-status-dropped/15 p-5 text-center space-y-2">
            <ShieldAlert className="h-8 w-8 text-status-dropped mx-auto" />
            <h2 className="font-display text-sm font-semibold text-status-dropped">
              Signups are Closed
            </h2>
            <p className="text-xs text-muted-foreground leading-normal">
              New registration has been disabled on this instance by the administrator.
            </p>
            <div className="pt-2">
              <Link to="/login" className="text-xs text-primary hover:underline font-medium">
                Go to login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                <User className="h-3 w-3" /> Display Name
              </Label>
              <Input
                id="name"
                type="text"
                required
                placeholder="Spike Spiegel"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-surface"
                autoComplete="name"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                <Mail className="h-3 w-3" /> Email Address
              </Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="spike@bebop.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-surface"
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pass" className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                <Lock className="h-3 w-3" /> Password
              </Label>
              <Input
                id="pass"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-surface"
                autoComplete="new-password"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-accent text-primary-foreground hover:opacity-95"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating account…
                </>
              ) : (
                "Sign Up"
              )}
            </Button>
          </form>
        )}

        {allowed !== false && (
          <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border/40">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Log in here
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
