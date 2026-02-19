import { defineConfig } from "tsup";

export default defineConfig([
  // ==========================================
  // 1. BUILD DA BIBLIOTECA (React, Vue, Core...)
  // ==========================================
  {
    entry: {
      index: "src/index.ts",
      "react/index": "src/react/index.ts",
      "react-native/index": "src/react-native/index.ts",
      "vue/index": "src/vue/index.ts",
      "angular/index": "src/angular/index.ts",
      "resolvers/zod": "src/resolvers/zod.ts",
      "resolvers/yup": "src/resolvers/yup.ts",
      "resolvers/joi": "src/resolvers/joi.ts",
      "devtools/index": "src/devtools/index.ts",
      "devtools/bridge": "src/devtools/bridge.ts",
    },
    tsconfig: "./tsconfig.build.json",
    format: ["cjs", "esm"],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,
    minify: true,
    external: ["react", "vue", "@angular/core", "zod", "yup", "joi", "rxjs"],
  },

  // ==========================================
  // 2. BUILD DA CLI (Linha de Comando Node.js)
  // ==========================================
  {
    entry: {
      "cli/index": "src/cli/index.ts",
    },
    tsconfig: "./tsconfig.build.json",
    format: ["cjs"],
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: false,
    minify: true,
  },
]);
