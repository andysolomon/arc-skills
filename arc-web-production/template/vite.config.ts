/**
 * npm run dev     dev server on 127.0.0.1:5173; /api is proxied to API_URL
 * npm run build   static files in dist/, served by whatever hosts the API (same origin)
 */
import { foldkit } from "@foldkit/vite-plugin"
import { defineConfig } from "vite"

const api = process.env.API_URL ?? "http://127.0.0.1:8787"

export default defineConfig({
  root: import.meta.dirname,
  plugins: [foldkit()],
  server: { host: "127.0.0.1", port: Number(process.env.WEB_PORT ?? 5173), strictPort: true, proxy: { "/api": api } },
  preview: { host: "127.0.0.1", proxy: { "/api": api } },
  build: { outDir: "dist", emptyOutDir: true }
})
