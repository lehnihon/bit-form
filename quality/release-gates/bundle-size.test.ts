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
}

const BUDGETS: EntrypointBudget[] = [
  // Medido: 75.2 KB  →  orçamento: 76 KB
  {
    name: "core (index)",
    entry: "src/index.ts",
    maxBytes: 76 * 1024,
  },
  // Medido: 69.6 KB  →  orçamento: 85 KB
  {
    name: "react/index",
    entry: "src/react/index.ts",
    maxBytes: 85 * 1024,
    external: ["react"],
  },
  // Medido: 68.5 KB  →  orçamento: 84 KB
  {
    name: "vue/index",
    entry: "src/vue/index.ts",
    maxBytes: 84 * 1024,
    external: ["vue"],
  },
  // Medido: 68.9 KB  →  orçamento: 84 KB
  {
    name: "angular/index",
    entry: "src/angular/index.ts",
    maxBytes: 84 * 1024,
    external: ["@angular/core", "rxjs"],
  },
  // Medido: 4.9 KB  →  orçamento: 8 KB
  {
    name: "mask",
    entry: "src/mask.ts",
    maxBytes: 8 * 1024,
  },
];

describe("release-gate bundle size", () => {
  for (const { name, entry, maxBytes, external = [] } of BUDGETS) {
    it(`${name} ≤ ${(maxBytes / 1024).toFixed(
      0,
    )} KB (minified ESM)`, async () => {
      const result = await build({
        entryPoints: [resolve(root, entry)],
        bundle: true,
        write: false,
        minify: true,
        format: "esm",
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
