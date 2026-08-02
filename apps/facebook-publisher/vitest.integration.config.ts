import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Integration tests chạy trong Electron runtime để better-sqlite3
 * load đúng native binding (đã rebuild cho Electron ABI).
 *
 * Docs §14 QA-001: integration cho API/SQLite/IPC/media/adapter.
 */
export default defineConfig({
  resolve: {
    alias: {
      // Tránh electron-vite aliases ảnh hưởng test.
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 15_000,
    globals: false,
    pool: "forks",
    poolOptions: {
      forks: {
        // Chạy test trong Electron process → load được better-sqlite3.
        execArgv: [],
        env: {
          ...process.env,
          // Báo cho tests dùng electron's require nếu cần.
        },
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/main/services/**/*.ts",
        "src/main/db/**/*.ts",
        "src/main/jobs/**/*.ts",
        "src/main/browser/**/*.ts",
        "src/main/template/**/*.ts",
      ],
      exclude: ["**/*.d.ts", "**/*.test.ts"],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
});
