import React, { useEffect, useState } from "react";
import { RouterProvider } from "./lib/router";
import { SiteHeader } from "./components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { rpc } from "./lib/rpc";

// Import pages
import Home from "./routes/index";
import AddPage from "./routes/add";
import { AnimePage } from "./routes/anime";
import { MangaPage } from "./routes/manga";
import { SeriesPage } from "./routes/series";
import SettingsPage from "./routes/settings";
import LoginPage from "./routes/login";
import SignupPage from "./routes/signup";
import DiscoverPage from "./routes/discover";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pathname, setPathname] = useState(window.location.pathname);

  const fetchSession = async () => {
    try {
      const res = await rpc.api.auth.me.$get();
      const ct = res.headers.get("content-type") || "";
      if (res.ok && ct.includes("application/json")) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch (e) {
      console.error("Failed to fetch user session", e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();

    const handlePopState = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (to: string) => {
    window.history.pushState({}, "", to);
    setPathname(to);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground bg-hero">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading AniStash...</p>
        </div>
      </div>
    );
  }

  const isAuthPage = pathname === "/login" || pathname === "/signup";

  // Navigation Guards
  if (!user && !isAuthPage) {
    window.history.replaceState({}, "", "/login");
    // Directly set pathname to trigger render of LoginPage
    setPathname("/login");
    return null;
  }

  if (user && isAuthPage) {
    window.history.replaceState({}, "", "/");
    setPathname("/");
    return null;
  }

  let pageComponent = null;
  if (pathname === "/") {
    pageComponent = <Home />;
  } else if (pathname === "/anime") {
    pageComponent = <AnimePage />;
  } else if (pathname === "/manga") {
    pageComponent = <MangaPage />;
  } else if (pathname === "/series") {
    pageComponent = <SeriesPage />;
  } else if (pathname === "/add") {
    pageComponent = <AddPage />;
  } else if (pathname === "/settings") {
    pageComponent = <SettingsPage />;
  } else if (pathname === "/login") {
    pageComponent = <LoginPage />;
  } else if (pathname === "/signup") {
    pageComponent = <SignupPage />;
  } else if (pathname === "/discover") {
    pageComponent = <DiscoverPage />;
  } else {
    // 404 Page
    pageComponent = (
      <div className="flex min-h-screen items-center justify-center bg-hero px-4">
        <div className="max-w-md text-center">
          <h1 className="font-display text-8xl font-bold text-gradient">404</h1>
          <h2 className="mt-4 font-display text-2xl font-semibold">
            Page not found
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This corner of the AniStash doesn't exist.
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-6 inline-flex rounded-lg bg-gradient-accent px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-card"
          >
            Back to library
          </button>
        </div>
      </div>
    );
  }

  return (
    <RouterProvider
      value={{ pathname, user, navigate, invalidate: fetchSession }}
    >
      <div className="min-h-screen bg-background bg-hero">
        {!isAuthPage && <SiteHeader />}
        {pageComponent}
        <Toaster theme="dark" position="top-center" />
      </div>
    </RouterProvider>
  );
}
