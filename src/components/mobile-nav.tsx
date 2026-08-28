import { Link, useRouter } from "@/lib/router";
import { Library, Tv, BookOpen, Film, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { to: "/", label: "Library", icon: Library },
  { to: "/anime", label: "Anime", icon: Tv },
  { to: "/manga", label: "Manga", icon: BookOpen },
  { to: "/series", label: "Series", icon: Film },
  { to: "/discover", label: "Discover", icon: Sparkles },
];

export function MobileNav() {
  const router = useRouter();
  const pathname = router.state.location.pathname;

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-3 inset-x-3 z-50 md:hidden flex justify-center pointer-events-none"
    >
      <div
        style={{
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
        }}
        className="pointer-events-auto flex w-full max-w-md items-center justify-between rounded-full border border-[rgba(255,243,224,0.12)] bg-[rgba(26,18,19,0.75)] p-1.5 shadow-[0_16px_50px_rgba(0,0,0,0.85)] transition-all"
      >
        {mobileNavItems.map((item) => {
          const isActive =
            item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-2 px-1 text-[11px] font-medium transition-all duration-200 active:scale-90",
                isActive
                  ? "bg-[#f0788a] text-white font-bold shadow-[0_0_18px_rgba(240,120,138,0.4)]"
                  : "text-[#968677] hover:text-[#fff3e0] hover:bg-[rgba(255,243,224,0.06)]",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 transition-transform",
                  isActive ? "scale-110 text-white" : "",
                )}
              />
              <span className="leading-tight tracking-tight text-[10px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
