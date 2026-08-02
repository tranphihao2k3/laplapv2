/**
 * Snapshot-only Vite config — bundle riêng cho scripts/ui-snapshot.ts.
 * Load cùng renderer bundle (share chunk qua out/snapshot/assets/) nhưng
 * override entry HTML để set __SNAPSHOT_BYPASS__ localStorage trước khi React mount.
 *
 * Chạy: electron-vite build --config electron.vite.config.snapshot.ts
 */
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "out/snapshot",
    emptyOutDir: true,
    rollupOptions: {
      input: { index: resolve(__dirname, "src/snapshot/index.html") },
    },
    assetsInlineLimit: 0,
  },
  resolve: {
    alias: {
      "@renderer": resolve(__dirname, "src/renderer/src"),
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
});