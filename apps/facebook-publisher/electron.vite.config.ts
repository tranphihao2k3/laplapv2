import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

/**
 * electron-vite config.
 *
 * Playwright kéo theo các optional dep (kerberos, etc.) không dùng trên Windows.
 * Ta externalize toàn bộ `playwright-core` + transitive optionals để Rollup không
 * cố bundle chúng (chỉ cần load runtime từ node_modules).
 */
const PLAYWRIGHT_OPTIONAL = [
  "playwright-core",
  "kerberos",
  "@grpc/grpc-js",
  "@grpc/proto-loader",
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/main",
      rollupOptions: {
        input: { index: resolve(__dirname, "src/main/index.ts") },
        external: PLAYWRIGHT_OPTIONAL,
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/preload",
      rollupOptions: {
        input: { index: resolve(__dirname, "src/preload/index.ts") },
        external: PLAYWRIGHT_OPTIONAL,
      },
    },
  },
  renderer: {
    plugins: [react()],
    build: {
      outDir: "out/renderer",
      rollupOptions: {
        input: { index: resolve(__dirname, "src/renderer/index.html") },
        external: PLAYWRIGHT_OPTIONAL,
      },
    },
    resolve: {
      alias: {
        "@renderer": resolve(__dirname, "src/renderer/src"),
        "@shared": resolve(__dirname, "src/shared"),
      },
    },
  },
});
