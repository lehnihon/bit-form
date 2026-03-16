import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const rootDir = path.resolve(__dirname, "../../../../");

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      "bit-form/core": path.resolve(rootDir, "src/core/index.ts"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
});
