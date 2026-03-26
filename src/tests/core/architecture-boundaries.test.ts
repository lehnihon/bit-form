import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { createBitStore } from "../../core";

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

  it("core fora de contracts não deve depender de wrappers legados de contratos", () => {
    const coreRoot = path.join(SRC_ROOT, "core");
    const sourceFiles = walkTsFiles(coreRoot).filter((filePath) => {
      const relative = path.relative(coreRoot, filePath);

      if (relative === "index.ts") {
        return false;
      }

      return true;
    });

    const forbiddenImportPattern =
      /from\s+["'](?:\.\/|\.\.\/)+public-types["']/g;

    const violations = sourceFiles.flatMap((filePath) => {
      const source = fs.readFileSync(filePath, "utf8");
      const hasViolation = forbiddenImportPattern.test(source);

      return hasViolation ? [path.relative(SRC_ROOT, filePath)] : [];
    });

    expect(violations).toEqual([]);
  });

  it("não deve existir wrapper legado public-types", () => {
    const legacyWrapperPath = path.join(
      SRC_ROOT,
      "core",
      "store",
      "contracts",
      "public-types.ts",
    );

    expect(fs.existsSync(legacyWrapperPath)).toBe(false);
  });

  it("testes de framework/integration não devem importar core/store internamente", () => {
    const targetDirs = [
      path.join(SRC_ROOT, "tests", "frameworks"),
      path.join(SRC_ROOT, "tests", "integration"),
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

  it("package root deve permanecer curado e não espelhar contratos avançados de core", () => {
    const rootEntry = fs.readFileSync(path.join(SRC_ROOT, "index.ts"), "utf8");

    expect(rootEntry).not.toMatch(/BitFormBindingApi/);
    expect(rootEntry).not.toMatch(/BitFieldBindingApi/);
    expect(rootEntry).not.toMatch(/BitArrayBindingApi/);
    expect(rootEntry).not.toMatch(/BitStoreQueryApi/);
  });

  it("testes de contrato (core/contract/) não devem importar internals de core/store", () => {
    const contractDir = path.join(SRC_ROOT, "tests", "core", "contract");

    if (!fs.existsSync(contractDir)) return;

    const sourceFiles = walkTsFiles(contractDir).filter((f) =>
      /\.test\.ts$/.test(f),
    );

    const forbiddenImportPattern = /from\s+["'][^"']*core\/store\//g;

    const violations = sourceFiles.flatMap((filePath) => {
      const source = fs.readFileSync(filePath, "utf8");
      const hasViolation = forbiddenImportPattern.test(source);

      return hasViolation ? [path.relative(SRC_ROOT, filePath)] : [];
    });

    expect(violations).toEqual([]);
  });

  it("BitStore deve expor contrato namespaced com os quatro objetos de capability", () => {
    // Este teste verifica em tempo de execução que o contrato namespaced
    // expõe os quatro sub-objetos de capability definidos pelo plano
    // arquitetural. Ele é intencional como boundary/smoke test.

    const store = createBitStore({ initialValues: { name: "" } }) as any;

    // namespaces primários devem existir na instância
    expect(store.read).toBeDefined();
    expect(store.observe).toBeDefined();
    expect(store.write).toBeDefined();
    expect(store.feature).toBeDefined();

    // quatro capability objects obrigatórios
    const { read, observe, write, feature } = store;
    expect(read).toBeDefined();
    expect(observe).toBeDefined();
    expect(write).toBeDefined();
    expect(feature).toBeDefined();

    // read: getState, getFieldState, storeId, isValid
    expect(typeof read.getState).toBe("function");
    expect(typeof read.getFieldState).toBe("function");
    expect(typeof read.storeId).toBe("string");
    expect(typeof read.isValid).toBe("boolean");

    // observe: subscribe, subscribeFieldState, subscribeSelector
    expect(typeof observe.subscribe).toBe("function");
    expect(typeof observe.subscribeFieldState).toBe("function");
    expect(typeof observe.subscribeSelector).toBe("function");

    // write: setField, reset, submit
    expect(typeof write.setField).toBe("function");
    expect(typeof write.reset).toBe("function");
    expect(typeof write.submit).toBe("function");

    // feature: cleanup, pushItem, undo
    expect(typeof feature.cleanup).toBe("function");
    expect(typeof feature.pushItem).toBe("function");
    expect(typeof feature.undo).toBe("function");
  });
});
