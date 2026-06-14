import { Link, useNavigate, useDocumentMetadata } from "@/lib/router";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, Mail, User, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { rpc } from "@/lib/rpc";

export default function SignupPage() {
  useDocumentMetadata(
    "Sign up — AniStash",
    "Create an account on AniStash."
  );
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [allowed, setAllowed] = useState<boolean>(true); // Default to true

  useEffect(() => {
    rpc.api.auth.status.$get()
      .then(res => res.json())
      .then((res) => {
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
      const res = await rpc.api.auth.signup.$post({
        json: { displayName, email, password }
      });
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        let errorMsg = "Failed to register account";
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
