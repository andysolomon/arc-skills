/**
 * npm run dev     dev server on 127.0.0.1:5173; /api is proxied to API_URL, sockets included
 * npm run build   static files in dist/, served by whatever hosts the API (same origin)
 */
import { foldkit } from "@foldkit/vite-plugin"
import { defineConfig } from "vite"

const api = process.env.API_URL ?? "http://127.0.0.1:8787"

export default defineConfig({
  root: import.meta.dirname,
  plugins: [foldkit()],
  // arc-realtime: `ws: true` makes the proxy pass the WebSocket upgrade for /api/room too
  server: { host: "127.0.0.1", port: Number(process.env.WEB_PORT ?? 5173), strictPort: true, proxy: { "/api": { target: api, ws: true } } },
  preview: { host: "127.0.0.1", proxy: { "/api": { target: api, ws: true } } },
  build: { outDir: "dist", emptyOutDir: true }
})
