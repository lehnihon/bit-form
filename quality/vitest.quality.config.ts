import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    testTimeout: 120_000,
    include: ["quality/**/*.test.{ts,tsx}", "quality/**/*.bench.ts"],
  },
});
