/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/vitest.setup.ts"],
    exclude: ["**/node_modules/**", "**/tests/e2e/**", ".next/**", "dist/**"],
    include: ["tests/unit/**/*.test.ts"],
    poolOptions: {
      threads: { singleThread: true },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["lib/**/*.ts", "app/api/**/*.ts"],
      exclude: ["**/*.test.ts", "**/node_modules/**", "tests/**"],
    },
    reporters: ["default", "./tests/vitest-fix-suggestions-reporter.ts"],
    testTimeout: 15000,
  },
});
