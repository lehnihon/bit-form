import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Gate informativo de artefatos de bundle.
 *
 * O orçamento estrito por entrypoint é validado em `bundle-size.test.ts`
 * via esbuild (minified + tree-shaken). Este teste mantém apenas um
 * smoke-check de presença dos artefatos no `dist` para evitar sinais
 * conflitantes entre metodologias de medição.
 */
describe("bundle artifacts gate (informational)", () => {
  it("detects expected dist entrypoints when dist exists", () => {
    const distDir = path.join(process.cwd(), "dist");

    if (!fs.existsSync(distDir)) {
      console.warn(
        "[bundle-size-gate] dist ausente; execute npm run build para validar artefatos.",
      );
      return;
    }

    const expectedArtifacts = [
      "index.js",
      path.join("core.js"),
      path.join("react", "index.js"),
      path.join("vue", "index.js"),
      path.join("angular", "index.js"),
    ];

    const missing = expectedArtifacts.filter(
      (artifact) => !fs.existsSync(path.join(distDir, artifact)),
    );

    expect(
      missing,
      `Artefatos ausentes em dist: ${missing.join(", ")}. Rode npm run build e revise tsup entrypoints.`,
    ).toEqual([]);
  });
});
