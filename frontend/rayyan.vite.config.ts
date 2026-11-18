import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Standalone RAYAN dev server.
 *
 * Also lets the main AgriNASA dev server keep running on 5173 (port 8000)
 * while RAYAN runs against the isolated API on 8001. Once the router is
 * included in `app/main.py`, the default `vite.config.ts` and `index.html`
 * serve these pages too and this file is no longer needed in development.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist-rayyan",
    rollupOptions: {
      input: {
        rayyan: "index.rayyan.html",
      },
    },
  },
});
