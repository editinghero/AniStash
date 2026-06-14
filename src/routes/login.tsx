import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";

export const loginUser = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email(),
      password: z.string().min(6),
    }),
  )
  .handler(async ({ data }) => {
    const { getDB } = await import("@/lib/db");
    const db = await getDB();
    const user = await db
      .prepare("SELECT id, password_hash FROM users WHERE email = ?")
      .bind(data.email.toLowerCase().trim())
      .first<{ id: string; password_hash: string | null }>();

    if (!user || !user.password_hash) {
      throw new Error("Invalid email or password");
    }

    const { verifyPassword } = await import("@/lib/crypto");
    const isValid = await verifyPassword(data.password, user.password_hash);
    if (!isValid) {
      throw new Error("Invalid email or password");
    }

    const { createSession } = await import("@/lib/auth");
    const { token, expiresAt } = await createSession(user.id);

    const httpMod = "vinxi/http";
    const { setResponseHeader } = await import(httpMod);
    const isDev = process.env.NODE_ENV === "development";
    setResponseHeader(
      "Set-Cookie",
      `anistash_session=${token}; Path=/; HttpOnly; SameSite=Lax${isDev ? "" : "; Secure"}; Expires=${new Date(expiresAt).toUTCString()}`,
    );

    return { success: true };
  });

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — AniStash" },
      { name: "description", content: "Sign in to your AniStash account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    try {
      await loginUser({ data: { email, password } });
      toast.success("Successfully logged in");
      // Force reload or redirect to root to refresh auth state
      window.location.href = "/";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sign in");
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
            Welcome back to AniStash
          </h1>
          <p className="text-xs text-muted-foreground">
            Enter your credentials below to access your library
          </p>
        </header>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              <Mail className="h-3 w-3" /> Email Address
            </Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="you@example.com"
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
              autoComplete="current-password"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-gradient-accent text-primary-foreground hover:opacity-95"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border/40">
          Don't have an account?{" "}
          <Link to="/signup" className="text-primary hover:underline font-medium">
            Sign up here
          </Link>
        </div>
      </div>
    </main>
  );
}
