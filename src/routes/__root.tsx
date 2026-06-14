import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  redirect,
} from "@tanstack/react-router";
import { useEffect } from "react";

import { SiteHeader } from "../components/site-header";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-8xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 font-display text-2xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This corner of the AniStash doesn't exist.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-lg bg-gradient-accent px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-card"
        >
          Back to library
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl font-semibold">Something glitched</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-lg bg-gradient-accent px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  user?: { id: string; email: string; displayName: string | null; avatarUrl: string | null } | null;
}>()({
  beforeLoad: async ({ location }) => {
    let user = null;
    try {
      const { rpc } = await import("../lib/rpc");
      const res = await rpc.api.auth.me.$get();
      // Guard: only parse JSON if the response is actually JSON
      // (Vite dev server may return index.html for unproxied /api routes)
      const ct = res.headers.get("content-type") || "";
      if (res.ok && ct.includes("application/json")) {
        user = await res.json();
      }
    } catch (e) {
      console.error("Failed to fetch user session", e);
    }
    const isAuthPage = location.pathname === "/login" || location.pathname === "/signup";
    if (!user && !isAuthPage) {
      throw redirect({ to: "/login" });
    }
    if (user && isAuthPage) {
      throw redirect({ to: "/" });
    }
    return { user };
  },
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background bg-hero">
        <SiteHeader />
        <Outlet />
        <Toaster theme="dark" position="top-center" />
      </div>
    </QueryClientProvider>
  );
}
