import { Link, useRouter, useRouteContext } from "@/lib/router";
import { Library, Plus, BookOpen, Tv, Film, Settings, LogOut, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { rpc } from "@/lib/rpc";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

const nav = [
  { to: "/", label: "Home", icon: Library },
  { to: "/anime", label: "Anime", icon: Tv },
  { to: "/manga", label: "Manga", icon: BookOpen },
  { to: "/series", label: "Series", icon: Film },
];

export function SiteHeader() {
  const router = useRouter();
  const pathname = router.state.location.pathname;
  const { user } = useRouteContext({ from: "__root__" }) as any;

  async function handleLogout() {
    try {
      await rpc.api.auth.logout.$post();
      router.invalidate();
      window.location.href = "/login";
    } catch {
      toast.error("Failed to log out");
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2.5 group shrink-0">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-accent shadow-glow font-display text-lg font-bold text-white transition-transform group-hover:rotate-3">
            鬼
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">
            Ani<span className="text-gradient">Stash</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {nav.map((n) => {
            const active =
              n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-surface text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface/60",
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user && (
            <div className="flex items-center gap-3 mr-2 border-r border-border/40 pr-3">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Stashing as <span className="font-semibold text-foreground">{user.displayName || user.email}</span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-[11px] font-medium text-muted-foreground hover:text-status-dropped transition-colors"
              >
                Log Out
              </button>
            </div>
          )}
          <Link
            to="/settings"
            className="grid h-9 w-9 place-items-center rounded-lg bg-surface/60 text-muted-foreground ring-1 ring-border/60 hover:text-foreground hover:bg-surface"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <Link
            to="/add"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-accent px-3 sm:px-4 py-2 text-sm font-semibold text-white shadow-card hover:opacity-95 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add from URL</span>
            <span className="sm:hidden">Add</span>
          </Link>
        </div>
      </div>
      <nav className="md:hidden flex items-center gap-1 px-4 pb-3">
        {nav.map((n) => {
          const active =
            n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
                active
                  ? "bg-surface text-foreground"
                  : "text-muted-foreground bg-surface/40",
              )}
            >
              <n.icon className="h-3.5 w-3.5" />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
