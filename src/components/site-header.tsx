import { Link, useRouter, useRouteContext } from "@/lib/router";
import {
  Library,
  Plus,
  BookOpen,
  Tv,
  Film,
  Settings,
  LogOut,
  User as UserIcon,
  Sparkles,
} from "lucide-react";
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
  { to: "/", icon: Library },
  { to: "/anime", label: "Anime", icon: Tv },
  { to: "/manga", label: "Manga", icon: BookOpen },
  { to: "/series", label: "Series", icon: Film },
  { to: "/discover", icon: Sparkles },
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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-background/70 shadow-[0_12px_40px_-28px_oklch(0_0_0/.8)] backdrop-blur-2xl">
      <div className="mx-auto flex h-20 max-w-6xl items-center gap-3 px-3 sm:gap-6 sm:px-4">
        <Link to="/" className="flex items-center gap-2.5 group shrink-0">
          <span className="grid h-11 w-11 place-items-center rounded-[1.35rem] bg-gradient-tonal shadow-glow font-display text-lg font-bold ring-1 ring-white/10 transition-transform group-hover:-rotate-6 group-hover:scale-105">
            <span className="bg-gradient-to-r from-[#ff604b] to-[#ff4ebb] bg-clip-text text-transparent">
              愛
            </span>
          </span>
          <span className="font-display text-2xl font-semibold tracking-tight">
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
                  "flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all",
                  active
                    ? "bg-primary/20 text-primary ring-1 ring-primary/30 shadow-card"
                    : "text-muted-foreground hover:bg-surface/70 hover:text-foreground",
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {user && (
            <div className="flex items-center gap-1.5 sm:gap-3 mr-1 sm:mr-2 border-r border-border/40 pr-1.5 sm:pr-3">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Stashing as{" "}
                <span className="font-semibold text-foreground">
                  {user.displayName || user.email}
                </span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-[10px] sm:text-[11px] font-medium text-muted-foreground hover:text-status-dropped transition-colors"
              >
                Log Out
              </button>
            </div>
          )}
          <Link
            to="/settings"
            className="grid h-9 w-9 place-items-center rounded-full bg-surface/70 text-muted-foreground ring-1 ring-border/60 hover:text-foreground hover:bg-surface"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <Link
            to="/add"
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-gradient-accent px-3 py-2.5 sm:px-5 text-xs sm:text-sm font-semibold text-white shadow-card hover:opacity-95 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Add from URL</span>
            <span className="sm:hidden">Add</span>
          </Link>
        </div>
      </div>
      <nav className="md:hidden flex items-center gap-1 px-3 sm:px-4 pb-3">
        {nav.map((n) => {
          const active =
            n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 sm:gap-2 rounded-full px-2 py-2 sm:px-3 text-xs font-medium",
                active
                  ? "bg-primary/20 text-primary ring-1 ring-primary/30 shadow-card"
                  : "text-muted-foreground bg-surface/40",
              )}
            >
              <n.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{n.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
