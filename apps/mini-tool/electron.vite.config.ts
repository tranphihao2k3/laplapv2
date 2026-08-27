import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist/main",
      lib: {
        entry: resolve(__dirname, "src/main/index.ts"),
        formats: ["cjs"],
        fileName: () => "index",
      },
      rollupOptions: {
        external: ["electron", "electron-store"],
        output: {
          entryFileNames: "index.cjs",
          format: "cjs",
          exports: "named",
        },
      },
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist/preload",
      lib: {
        entry: resolve(__dirname, "src/preload/index.ts"),
        formats: ["cjs"],
        fileName: () => "index",
      },
      rollupOptions: {
        external: ["electron"],
        output: {
          entryFileNames: "index.cjs",
          format: "cjs",
          exports: "named",
        },
      },
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    build: {
      outDir: "dist/renderer",
      rollupOptions: {
        input: resolve(__dirname, "src/renderer/index.html"),
      },
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "src/renderer"),
      },
    },
    plugins: [react()],
  },
});