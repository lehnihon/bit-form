// @vitest-environment node

/**
 * Release gate: bundle size por entrypoint
 *
 * Cada entrada é bundlada com esbuild (minified + tree-shaken, sem externals
 * de framework) e o tamanho resultante é comparado ao orçamento definido.
 *
 * Ao falhar, o erro exibe o tamanho atual e o máximo permitido para facilitar
 * o ajuste consciente do orçamento.
 *
 * Orçamentos definidos com ~20 % de folga sobre os tamanhos medidos em
 * 17/03/2026 (see comments inline).
 */
import { build } from "esbuild";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const root = resolve(fileURLToPath(import.meta.url), "../../..");

interface EntrypointBudget {
  /** Label exibido na falha do teste */
  name: string;
  /** Caminho relativo à raiz do projeto */
  entry: string;
  /** Tamanho máximo em bytes (minified ESM, sem externals) */
  maxBytes: number;
  /** Dependências externas que não devem ser embutidas */
  external?: string[];
  /** Plataforma de build para o entrypoint */
  platform?: "browser" | "node";
  /** Formato de saída da medição */
  format?: "esm" | "cjs";
}

const BUDGETS: EntrypointBudget[] = [
  // Medido: 108.7 KB (14/04/2026)  →  orçamento: 110 KB
  {
    name: "core (index)",
    entry: "src/index.ts",
    maxBytes: 110 * 1024,
  },
  // Medido: 69.6 KB  →  orçamento: 100 KB
  {
    name: "react/index",
    entry: "src/react/index.ts",
    maxBytes: 100 * 1024,
    external: ["react"],
  },
  // Medido: 68.5 KB  →  orçamento: 100 KB
  {
    name: "vue/index",
    entry: "src/vue/index.ts",
    maxBytes: 100 * 1024,
    external: ["vue"],
  },
  // Medido: 68.9 KB  →  orçamento: 100 KB
  {
    name: "angular/index",
    entry: "src/angular/index.ts",
    maxBytes: 100 * 1024,
    external: ["@angular/core", "rxjs"],
  },
  // Medido: 4.9 KB  →  orçamento: 12 KB
  {
    name: "mask",
    entry: "src/mask.ts",
    maxBytes: 12 * 1024,
  },
  // Medido: baseline inicial desta fase — orçamento conservador
  {
    name: "devtools/index",
    entry: "src/devtools/index.ts",
    maxBytes: 120 * 1024,
  },
  // Medido: baseline inicial desta fase — orçamento conservador
  {
    name: "devtools/bridge",
    entry: "src/devtools/bridge.ts",
    maxBytes: 32 * 1024,
  },
  // Medido: baseline inicial desta fase — orçamento conservador
  {
    name: "cli/index",
    entry: "src/cli/index.ts",
    maxBytes: 80 * 1024,
    platform: "node",
    format: "cjs",
    external: ["ws", "node:http", "node:fs", "node:path", "node:url"],
  },
];

describe("release-gate bundle size", () => {
  for (const {
    name,
    entry,
    maxBytes,
    external = [],
    platform = "browser",
    format = "esm",
  } of BUDGETS) {
    it(`${name} ≤ ${(maxBytes / 1024).toFixed(
      0,
    )} KB (minified ${format.toUpperCase()})`, async () => {
      const result = await build({
        entryPoints: [resolve(root, entry)],
        bundle: true,
        write: false,
        minify: true,
        format,
        platform,
        external,
        // Silencia avisos irrelevantes para a medição
        logLevel: "silent",
      });

      const bytes = result.outputFiles[0].contents.byteLength;
      const kb = (bytes / 1024).toFixed(1);
      const budgetKb = (maxBytes / 1024).toFixed(0);

      expect(
        bytes,
        `Bundle "${name}" possui ${kb} KB — limite é ${budgetKb} KB. ` +
          `Ajuste o orçamento em bundle-size.test.ts caso o crescimento seja intencional.`,
      ).toBeLessThanOrEqual(maxBytes);
    });
  }
});
