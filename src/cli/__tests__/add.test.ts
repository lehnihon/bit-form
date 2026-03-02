/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runAddCommand } from "../add";

describe("bit-form add", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bit-form-add-"));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    try {
      fs.rmSync(tmpDir, { recursive: true });
    } catch {
      // ignore
    }
  });

  it("throws when adapter name is missing", () => {
    expect(() => runAddCommand([])).toThrow(
      "bit-form add: missing adapter name",
    );
  });

  it("throws when adapter is unknown", () => {
    expect(() => runAddCommand(["unknown", "input"])).toThrow(
      'unknown adapter "unknown"',
    );
  });

  it("throws when component is invalid", () => {
    expect(() => runAddCommand(["shadcn", "invalid-component"])).toThrow(
      "Unknown shadcn component",
    );
  });

  it("generates input wrapper in current dir with default ui-path", () => {
    runAddCommand(["shadcn", "input", "--path", "."]);

    const filePath = path.join(tmpDir, "bit-form-input.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
    const contents = fs.readFileSync(filePath, "utf-8");
    expect(contents).toContain('from "@/components/ui/input"');
    expect(contents).toContain("useBitField");
    expect(contents).toContain("BitFormInput");
    expect(contents).toMatchSnapshot();
  });

  it("generates multiple components", () => {
    runAddCommand(["shadcn", "input", "textarea", "checkbox", "--path", "."]);

    expect(fs.existsSync(path.join(tmpDir, "bit-form-input.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "bit-form-textarea.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "bit-form-checkbox.tsx"))).toBe(true);
  });

  it("uses --ui-path in generated imports", () => {
    runAddCommand([
      "shadcn",
      "input",
      "--path",
      ".",
      "--ui-path",
      "@/lib/ui",
    ]);

    const contents = fs.readFileSync(path.join(tmpDir, "bit-form-input.tsx"), "utf-8");
    expect(contents).toContain('from "@/lib/ui/input"');
  });

  it("writes to --path subdirectory", () => {
    runAddCommand(["shadcn", "input", "--path", "out/forms"]);

    const filePath = path.join(tmpDir, "out", "forms", "bit-form-input.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("skips existing file without --overwrite", () => {
    runAddCommand(["shadcn", "input", "--path", "."]);
    const filePath = path.join(tmpDir, "bit-form-input.tsx");
    fs.writeFileSync(filePath, "custom content", "utf-8");

    runAddCommand(["shadcn", "input", "--path", "."]);

    expect(fs.readFileSync(filePath, "utf-8")).toBe("custom content");
  });

  it("overwrites existing file with --overwrite", () => {
    runAddCommand(["shadcn", "input", "--path", "."]);
    const filePath = path.join(tmpDir, "bit-form-input.tsx");
    fs.writeFileSync(filePath, "custom content", "utf-8");

    runAddCommand(["shadcn", "input", "--path", ".", "--overwrite"]);

    const contents = fs.readFileSync(filePath, "utf-8");
    expect(contents).toContain("useBitField");
    expect(contents).not.toBe("custom content");
  });

  it("generates all components when none specified", () => {
    runAddCommand(["shadcn", "--path", "."]);

    expect(fs.existsSync(path.join(tmpDir, "bit-form-input.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "bit-form-textarea.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "bit-form-select.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "bit-form-checkbox.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "bit-form-switch.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "bit-form-radio-group.tsx"))).toBe(true);
  });
});
