import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
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
