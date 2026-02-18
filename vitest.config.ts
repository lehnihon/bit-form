import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
  plugins: [react(), vue()],
  resolve: {
    alias: {
      "bit-form/core": path.resolve(__dirname, "./src/core"),
      "bit-form/react": path.resolve(__dirname, "./src/react"),
      "bit-form/vue": path.resolve(__dirname, "./src/vue"),
      "bit-form/angular": path.resolve(__dirname, "./src/angular"),
      "bit-form": path.resolve(__dirname, "./src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    server: {
      deps: {
        inline: [/@angular/, /zone.js/],
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
    },
  },
});
