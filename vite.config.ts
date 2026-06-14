import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      server: { 
        entry: "src/server.ts",
        preset: "cloudflare-pages"
      },
    }),
    react(),
  ],
});
