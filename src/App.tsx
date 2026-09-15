import React, { useEffect, useState } from "react";
import { RouterProvider } from "./lib/router";
import { SiteHeader } from "./components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { PinLockScreen } from "./components/pin-lock-screen";
import { clearLocalPin, hasLocalPinForUser } from "./lib/local-pin";

import { MobileNav } from "./components/mobile-nav";

// Import pages
import Home from "./routes/index";
import AddPage from "./routes/add";
import { AnimePage } from "./routes/anime";
import { MangaPage } from "./routes/manga";
import { SeriesPage } from "./routes/series";
import SettingsPage from "./routes/settings";
import DiscoverPage from "./routes/discover";

// Stable local user — no server auth needed (archived, localStorage mode)
const LOCAL_USER = { id: "local", displayName: "You", email: "local@anistash" };

export default function App() {
  const [pinRequired, setPinRequired] = useState(
    () => hasLocalPinForUser(LOCAL_USER.id),
  );
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [location, setLocation] = useState(() => ({
    pathname: window.location.pathname,
    search: window.location.search,
  }));
  const { pathname } = location;

  useEffect(() => {
    const handlePopState = () => {
      setLocation({
        pathname: window.location.pathname,
        search: window.location.search,
      });
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (to: string) => {
    const next = new URL(to, window.location.origin);
    window.history.pushState({}, "", `${next.pathname}${next.search}`);
    setLocation({ pathname: next.pathname, search: next.search });
  };

  const handlePinLockout = async (): Promise<boolean> => {
    clearLocalPin(LOCAL_USER.id);
    setPinRequired(false);
    setPinUnlocked(false);
    return true;
  };

  if (pinRequired && !pinUnlocked) {
    return (
      <PinLockScreen
        userId={LOCAL_USER.id}
        onUnlocked={() => setPinUnlocked(true)}
        onLockout={handlePinLockout}
      />
    );
  }

  // Redirect /login and /signup to home
  if (pathname === "/login" || pathname === "/signup") {
    window.history.replaceState({}, "", "/");
    setLocation({ pathname: "/", search: "" });
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
  } else if (pathname === "/discover") {
    pageComponent = <DiscoverPage />;
  } else {
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
      value={{
        pathname,
        search: location.search,
        user: LOCAL_USER,
        navigate,
        invalidate: () => {},
      }}
    >
      <div className="min-h-screen bg-background bg-hero pb-24 md:pb-12">
        <SiteHeader />
        {pageComponent}
        <MobileNav />
        <Toaster theme="dark" position="top-center" />
      </div>
    </RouterProvider>
  );
}
