import { Link, useRouter, useRouteContext } from "@/lib/router";
import {
  Library,
  Plus,
  BookOpen,
  Tv,
  Film,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Library", icon: Library },
  { to: "/anime", label: "Anime", icon: Tv },
  { to: "/manga", label: "Manga", icon: BookOpen },
  { to: "/series", label: "Series", icon: Film },
  { to: "/discover", label: "Discover", icon: Sparkles },
];

export function SiteHeader() {
  const router = useRouter();
  const pathname = router.state.location.pathname;

  return (
    <header className="sticky top-2 sm:top-4 z-40 px-3 sm:px-4 mb-4 sm:mb-8">
      <nav
        className="mx-auto flex max-w-5xl items-center justify-between rounded-full border border-[rgba(255,243,224,0.07)] bg-[rgba(34,25,26,0.85)] px-3.5 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-all sm:px-5 sm:py-2.5"
        aria-label="Main Navigation"
      >
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-[rgba(240,120,138,0.4)] bg-[#22191a] shadow-[0_0_14px_rgba(240,120,138,0.25)] transition-transform group-hover:scale-105">
            <span className="font-display text-sm sm:text-base font-bold text-[#f0788a]">
              愛
            </span>
          </div>
          <span className="font-display text-base sm:text-lg font-bold tracking-tight text-[#fff3e0]">
            Ani<span className="text-[#f0788a]">Stash</span>
          </span>
        </Link>

        {/* Desktop Navigation Links (PC Only) */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const active =
              item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;

            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 hover:scale-[1.03] active:scale-95",
                  active
                    ? "bg-[#f0788a] text-white font-bold shadow-[0_0_16px_rgba(240,120,138,0.35)]"
                    : "text-[#dbc9b5] hover:text-[#fff3e0] hover:bg-[rgba(255,243,224,0.06)]",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Settings Button */}
          <Link
            to="/settings"
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-[rgba(255,243,224,0.08)] text-[#dbc9b5] hover:text-[#fff3e0] hover:border-[rgba(240,120,138,0.4)] hover:bg-[rgba(255,243,224,0.06)] hover:scale-105 active:scale-95 transition-all"
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>

          {/* Add Button */}
          <Link
            to="/add"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#f0788a] px-3 sm:px-4 py-1.5 text-xs font-semibold text-white shadow-[0_0_18px_rgba(240,120,138,0.3)] hover:brightness-110 hover:scale-[1.03] active:scale-95 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add from URL</span>
            <span className="sm:hidden">Add</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
