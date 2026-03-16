import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["quality/**/*.test.{ts,tsx}"],
  },
});
