import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    tsConfigPaths(),
    tailwindcss(),
    react(),
  ],
  optimizeDeps: {
    exclude: ["wrangler"],
  },
  build: {
    target: "esnext",
  },
});
