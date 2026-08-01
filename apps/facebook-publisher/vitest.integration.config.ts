import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 10_000,
    globals: false,
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
        // Targets from docs §14 QA-001.
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
});
