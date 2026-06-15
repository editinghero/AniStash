import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifestFilename: "manifest.json",
      manifest: {
        name: "AniStash — Anime & Manga Tracker",
        short_name: "AniStash",
        description: "Stash every anime, manga, and series worth remembering.",
        theme_color: "#181422",
        background_color: "#181422",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        lang: "en",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ["wrangler"],
  },
  build: {
    target: "esnext",
  },
});
