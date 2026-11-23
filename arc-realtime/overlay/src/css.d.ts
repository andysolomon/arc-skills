// arc-realtime: entry.ts imports realtime.css for its side effect. Vite bundles it; this tells tsc the import is fine.
declare module "*.css" {}
