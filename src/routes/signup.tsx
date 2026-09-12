import { Link, useNavigate, useDocumentMetadata } from "@/lib/router";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, Mail, User, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { rpc } from "@/lib/rpc";

export default function SignupPage() {
  useDocumentMetadata("Sign up — AniStash", "Create an account on AniStash.");
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [allowed, setAllowed] = useState<boolean>(true);

  useEffect(() => {
    rpc.api.auth.status
      .$get()
      .then((res) => res.json())
      .then((res) => {
        setAllowed(res.allowed);
      })
      .catch((err) => {
        console.error("[Signup Page] Failed to get signup status:", err);
        setAllowed(true);
      });
  }, []);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim() || !email.trim() || !password.trim()) return;

    setLoading(true);
    try {
      const res = await rpc.api.auth.signup.$post({
        json: { displayName, email, password },
      });
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        let errorMsg = "Failed to register account";
        if (contentType.includes("application/json")) {
          const data = (await res.json()) as any;
          if (typeof data.error === "string") {
            errorMsg = data.error;
          } else if (data.error && typeof data.error === "object") {
            errorMsg =
              data.error.message ||
              data.error.issues?.[0]?.message ||
              JSON.stringify(data.error);
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
      toast.error(
        err instanceof Error ? err.message : "Failed to register account",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4 py-12">
      <div className="w-full space-y-6 rounded-3xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] p-8 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <header className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(240,120,138,0.35)] bg-[#191213] p-2.5 shadow-[0_0_24px_rgba(240,120,138,0.25)]">
            <img
              src="/icon-512.png"
              alt="AniStash"
              className="h-full w-full object-contain rounded-lg"
            />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#fff3e0]">
            Create an AniStash Account
          </h1>
          <p className="text-xs text-[#968677]">
            Start stashing and tracking your anime & manga lists
          </p>
        </header>

        {allowed === false ? (
          <div className="rounded-2xl border border-dashed border-[#e02e2a]/50 bg-[#e02e2a]/10 p-5 text-center space-y-2">
            <ShieldAlert className="h-8 w-8 text-[#e02e2a] mx-auto" />
            <h2 className="font-display text-sm font-semibold text-[#e02e2a]">
              Signups are Closed
            </h2>
            <p className="text-xs text-[#968677] leading-normal">
              New registration has been disabled on this instance by the
              administrator.
            </p>
            <div className="pt-2">
              <Link
                to="/login"
                className="text-xs text-[#f0788a] hover:underline font-semibold"
              >
                Go to login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="name"
                className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#dbc9b5]"
              >
                <User className="h-3 w-3 text-[#f0788a]" /> Display Name
              </Label>
              <Input
                id="name"
                type="text"
                required
                placeholder="Spike Spiegel"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] px-4 text-xs text-[#fff3e0] placeholder:text-[#968677] focus:border-[#f0788a] focus:bg-[rgba(255,243,224,0.08)]"
                autoComplete="name"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#dbc9b5]"
              >
                <Mail className="h-3 w-3 text-[#f0788a]" /> Email Address
              </Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="spike@bebop.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] px-4 text-xs text-[#fff3e0] placeholder:text-[#968677] focus:border-[#f0788a] focus:bg-[rgba(255,243,224,0.08)]"
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="pass"
                className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#dbc9b5]"
              >
                <Lock className="h-3 w-3 text-[#f0788a]" /> Password
              </Label>
              <Input
                id="pass"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] px-4 text-xs text-[#fff3e0] placeholder:text-[#968677] focus:border-[#f0788a] focus:bg-[rgba(255,243,224,0.08)]"
                autoComplete="new-password"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-[#f0788a] py-2.5 text-xs font-semibold text-white shadow-[0_0_20px_rgba(240,120,138,0.3)] hover:brightness-110 active:scale-95 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating
                  account…
                </>
              ) : (
                "Sign Up"
              )}
            </Button>
          </form>
        )}

        {allowed !== false && (
          <div className="text-center text-xs text-[#968677] pt-2 border-t border-[rgba(255,243,224,0.06)]">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-[#f0788a] hover:underline font-semibold"
            >
              Log in here
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
