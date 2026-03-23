import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

type DistBudget = {
  artifact: string;
  maxKb: number;
};

const DIST_BUDGETS: DistBudget[] = [
  { artifact: "index.js", maxKb: 100 },
  { artifact: "core.js", maxKb: 95 },
  { artifact: path.join("react", "index.js"), maxKb: 110 },
  { artifact: path.join("vue", "index.js"), maxKb: 110 },
  { artifact: path.join("angular", "index.js"), maxKb: 110 },
  { artifact: path.join("devtools", "index.js"), maxKb: 130 },
  { artifact: path.join("devtools", "bridge.js"), maxKb: 35 },
  { artifact: path.join("devtools", "protocol.js"), maxKb: 12 },
  { artifact: path.join("cli", "index.cjs"), maxKb: 85 },
  { artifact: "mask.js", maxKb: 12 },
];

describe("bundle artifacts gate (dist budgets)", () => {
  it("validates expected dist entrypoints and size budgets", () => {
    const distDir = path.join(process.cwd(), "dist");

    expect(
      fs.existsSync(distDir),
      "dist ausente; execute npm run build antes de rodar os release gates.",
    ).toBe(true);

    const missing = DIST_BUDGETS.map((entry) => entry.artifact).filter(
      (artifact) => !fs.existsSync(path.join(distDir, artifact)),
    );

    expect(
      missing,
      `Artefatos ausentes em dist: ${missing.join(", ")}. Rode npm run build e revise tsup entrypoints.`,
    ).toEqual([]);

    const overBudget = DIST_BUDGETS.map(({ artifact, maxKb }) => {
      const filePath = path.join(distDir, artifact);
      const stats = fs.statSync(filePath);
      const sizeKb = stats.size / 1024;
      return { artifact, maxKb, sizeKb };
    }).filter((entry) => entry.sizeKb > entry.maxKb);

    expect(
      overBudget,
      overBudget.length
        ? `Artefatos acima do orçamento: ${overBudget
            .map(
              (entry) =>
                `${entry.artifact}=${entry.sizeKb.toFixed(1)}KB (max ${entry.maxKb}KB)`,
            )
            .join(", ")}`
        : undefined,
    ).toEqual([]);
  });
});
