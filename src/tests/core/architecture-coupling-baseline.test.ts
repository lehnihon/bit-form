import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(__dirname, "..", "..");
const CORE_ROOT = path.join(SRC_ROOT, "core");

type CouplingMetric = {
  fanIn: number;
  fanOut: number;
};

function walkTsFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkTsFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

function resolveRelativeImport(
  fromFile: string,
  importPath: string,
  allFiles: Set<string>,
): string | null {
  if (!importPath.startsWith(".")) {
    return null;
  }

  const basePath = path.resolve(path.dirname(fromFile), importPath);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
  ];

  for (const candidate of candidates) {
    const normalized = path.normalize(candidate);
    if (allFiles.has(normalized)) {
      return normalized;
    }
  }

  return null;
}

function buildCouplingMetrics(): Record<string, CouplingMetric> {
  const files = walkTsFiles(CORE_ROOT).map((filePath) => path.normalize(filePath));
  const allFiles = new Set(files);
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, number>(files.map((filePath) => [filePath, 0]));

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, "utf8");
    const imports = new Set<string>();
    const staticImportPattern = /from\s+["']([^"']+)["']/g;

    let match = staticImportPattern.exec(source);
    while (match) {
      const resolved = resolveRelativeImport(filePath, match[1], allFiles);
      if (resolved) {
        imports.add(resolved);
      }
      match = staticImportPattern.exec(source);
    }

    outgoing.set(filePath, imports);
  }

  for (const targets of outgoing.values()) {
    for (const target of targets) {
      incoming.set(target, (incoming.get(target) ?? 0) + 1);
    }
  }

  const criticalFiles = [
    "store/orchestration/store-composition-root.ts",
    "store/orchestration/store-runtime-feature-composition.ts",
    "store/orchestration/capability-ports.ts",
    "store/managers/features/validation-manager.ts",
    "store/managers/features/lifecycle-manager.ts",
    "store/engines/effect-engine.ts",
    "store/engines/subscription-engine.ts",
    "store/shared/store-state-reader.ts",
  ];

  const metrics: Record<string, CouplingMetric> = {};

  for (const relativePath of criticalFiles) {
    const absolutePath = path.normalize(path.join(CORE_ROOT, relativePath));
    metrics[relativePath] = {
      fanIn: incoming.get(absolutePath) ?? 0,
      fanOut: outgoing.get(absolutePath)?.size ?? 0,
    };
  }

  return metrics;
}

describe("architecture coupling baseline", () => {
  it("core critical files devem respeitar baseline de fan-in/fan-out", () => {
    const metrics = buildCouplingMetrics();

    const baselineMax: Record<string, CouplingMetric> = {
      "store/orchestration/store-composition-root.ts": {
        fanIn: 1,
        fanOut: 15,
      },
      "store/orchestration/store-runtime-feature-composition.ts": {
        fanIn: 1,
        fanOut: 12,
      },
      "store/orchestration/capability-ports.ts": {
        fanIn: 1,
        fanOut: 9,
      },
      "store/managers/features/validation-manager.ts": {
        fanIn: 2,
        fanOut: 10,
      },
      "store/managers/features/lifecycle-manager.ts": {
        fanIn: 2,
        fanOut: 6,
      },
      "store/engines/effect-engine.ts": {
        fanIn: 6,
        fanOut: 3,
      },
      "store/engines/subscription-engine.ts": {
        fanIn: 4,
        fanOut: 3,
      },
      "store/shared/store-state-reader.ts": {
        fanIn: 3,
        fanOut: 3,
      },
    };

    for (const [file, max] of Object.entries(baselineMax)) {
      expect(metrics[file].fanIn).toBeLessThanOrEqual(max.fanIn);
      expect(metrics[file].fanOut).toBeLessThanOrEqual(max.fanOut);
    }
  });
});
