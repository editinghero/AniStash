import { Link, useNavigate, useDocumentMetadata } from "@/lib/router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { rpc } from "@/lib/rpc";

export default function LoginPage() {
  useDocumentMetadata(
    "Sign in — AniStash",
    "Sign in to your AniStash account."
  );
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    try {
      const res = await rpc.api.auth.login.$post({
        json: { email, password }
      });
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        let errorMsg = "Failed to sign in";
        if (contentType.includes("application/json")) {
          const data = (await res.json()) as any;
          if (typeof data.error === "string") {
            errorMsg = data.error;
          } else if (data.error && typeof data.error === "object") {
            errorMsg = data.error.message || data.error.issues?.[0]?.message || JSON.stringify(data.error);
          } else if (data.message) {
            errorMsg = data.message;
          }
        } else {
          const text = await res.text();
          errorMsg = text || errorMsg;
        }
        throw new Error(errorMsg);
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
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
          <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-gradient-accent shadow-glow font-display text-xl font-bold text-white">
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
            className="w-full mt-2 bg-gradient-accent text-white hover:opacity-95"
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
