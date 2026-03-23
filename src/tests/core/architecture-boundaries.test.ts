import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const SRC_ROOT = path.resolve(__dirname, "..", "..");

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

describe("architecture boundaries", () => {
  it("devtools e cli não devem importar contratos internos de core/store/contracts", () => {
    const targetDirs = [
      path.join(SRC_ROOT, "devtools"),
      path.join(SRC_ROOT, "cli"),
    ];

    const sourceFiles = targetDirs.flatMap((dir) => walkTsFiles(dir));

    const forbiddenImportPattern = /from\s+["'][^"']*core\/store\/contracts\//g;

    const violations = sourceFiles.flatMap((filePath) => {
      const source = fs.readFileSync(filePath, "utf8");
      const hasViolation = forbiddenImportPattern.test(source);

      return hasViolation ? [path.relative(SRC_ROOT, filePath)] : [];
    });

    expect(violations).toEqual([]);
  });

  it("adapters/frameworks/devtools/cli não devem importar core/store internamente", () => {
    const targetDirs = [
      path.join(SRC_ROOT, "react"),
      path.join(SRC_ROOT, "react-native"),
      path.join(SRC_ROOT, "vue"),
      path.join(SRC_ROOT, "angular"),
      path.join(SRC_ROOT, "devtools"),
      path.join(SRC_ROOT, "cli"),
    ];

    const sourceFiles = targetDirs.flatMap((dir) => walkTsFiles(dir));

    const forbiddenImportPattern = /from\s+["'][^"']*core\/store\//g;

    const violations = sourceFiles.flatMap((filePath) => {
      const source = fs.readFileSync(filePath, "utf8");
      const hasViolation = forbiddenImportPattern.test(source);

      return hasViolation ? [path.relative(SRC_ROOT, filePath)] : [];
    });

    expect(violations).toEqual([]);
  });
});
