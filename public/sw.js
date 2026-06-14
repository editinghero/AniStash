const CACHE_NAME = "anistash-cache-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/splash-logo-square.png",
  "/icon-512.png"
];

// Install Event: cache static shell assets
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn("Failed to cache initial assets during install:", err);
      });
    })
  );
});

// Activate Event: clean up old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Fetch Event: SPA navigation fallback and dynamic runtime caching
self.addEventListener("fetch", (e) => {
  // Don't intercept non-GET requests or API requests
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.pathname.startsWith("/api/")) {
    return;
  }

  // Navigation requests: Serve cached app shell index.html
  if (e.request.mode === "navigate") {
    e.respondWith(
      caches.match("/index.html").then((cachedResponse) => {
        return cachedResponse || fetch(e.request).catch(() => {
          return caches.match("/index.html");
        });
      })
    );
    return;
  }

  // Standard static assets (JS, CSS, images, etc.): Cache-first with network fallback and dynamic caching
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((response) => {
        // Cache successful static responses
        if (response && response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        // Fallback for missing images/assets
        return new Response("Asset offline", { status: 408 });
      });
    })
  );
});
