import { describe, expect, it } from "vitest";
import { BitDependencyManager } from "../../core/store/managers/core/dependency-manager";

describe("BitDependencyManager", () => {
  it("evaluateAll should process only fields with showIf", () => {
    const manager = new BitDependencyManager<{
      a: boolean;
      b: string;
      c: string;
    }>();

    manager.register(
      "b",
      {
        conditional: {
          dependsOn: ["a"],
          showIf: (values) => values.a,
        },
      },
      { a: false, b: "", c: "" },
    );

    manager.register(
      "c",
      {
        validation: {
          asyncValidate: async () => undefined,
        },
      },
      { a: false, b: "", c: "" },
    );

    manager.evaluateAll({ a: true, b: "", c: "" });
    expect(manager.isHidden("b")).toBe(false);
    expect(manager.isHidden("c")).toBe(false);

    manager.evaluateAll({ a: false, b: "", c: "" });
    expect(manager.isHidden("b")).toBe(true);
    expect(manager.isHidden("c")).toBe(false);
  });

  it("isRequired should keep behavior stable across register/unregister cache invalidation", () => {
    const manager = new BitDependencyManager<{ mode: string; doc: string }>();

    const values = { mode: "on", doc: "" };

    manager.register(
      "doc",
      {
        conditional: {
          dependsOn: ["mode"],
          requiredIf: (v) => v.mode === "on",
        },
      },
      values,
    );

    expect(manager.isRequired("doc", values)).toBe(true);

    manager.unregister("doc");
    manager.register(
      "doc",
      {
        conditional: {
          dependsOn: ["mode"],
          requiredIf: (v) => v.mode === "off",
        },
      },
      values,
    );

    expect(manager.isRequired("doc", values)).toBe(false);
  });
});
