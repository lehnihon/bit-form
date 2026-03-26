import { describe, expect, it } from "vitest";
import { BitFieldRegistry } from "../../core/store/registry/field-registry";

describe("BitFieldRegistry", () => {
  it("evaluateAll processa somente fields com showIf", () => {
    const registry = new BitFieldRegistry<{
      a: boolean;
      b: string;
      c: string;
    }>();

    registry.register(
      "b",
      {
        conditional: {
          dependsOn: ["a"],
          showIf: (values) => values.a,
        },
      },
      { a: false, b: "", c: "" },
    );

    registry.register(
      "c",
      {
        validation: {
          asyncValidate: async () => undefined,
        },
      },
      { a: false, b: "", c: "" },
    );

    registry.evaluateAll({ a: true, b: "", c: "" });
    expect(registry.isHidden("b")).toBe(false);
    expect(registry.isHidden("c")).toBe(false);

    registry.evaluateAll({ a: false, b: "", c: "" });
    expect(registry.isHidden("b")).toBe(true);
    expect(registry.isHidden("c")).toBe(false);
  });

  it("isRequired mantém comportamento estável após unregister/register", () => {
    const registry = new BitFieldRegistry<{ mode: string; doc: string }>();

    const values = { mode: "on", doc: "" };

    registry.register(
      "doc",
      {
        conditional: {
          dependsOn: ["mode"],
          requiredIf: (v) => v.mode === "on",
        },
      },
      values,
    );

    expect(registry.isRequired("doc", values)).toBe(true);

    registry.unregister("doc");
    registry.register(
      "doc",
      {
        conditional: {
          dependsOn: ["mode"],
          requiredIf: (v) => v.mode === "off",
        },
      },
      values,
    );

    expect(registry.isRequired("doc", values)).toBe(false);
  });

  it("mantém índices de scope/computed/transform atualizados", () => {
    const registry = new BitFieldRegistry<{
      price: number;
      total: number;
      name: string;
      items: Array<{ value: number }>;
    }>();

    registry.register(
      "price",
      {
        scope: "pricing",
      },
      { price: 10, total: 0, name: "", items: [] },
    );

    registry.register(
      "total",
      {
        scope: "pricing",
        computed: (values) => values.price * 2,
        computedDependsOn: ["price"],
      },
      { price: 10, total: 0, name: "", items: [] },
    );

    registry.register(
      "name",
      {
        normalize: (value) => String(value).trim(),
        transform: (value) => String(value).trim(),
      },
      { price: 10, total: 0, name: "", items: [] },
    );

    expect(registry.getScopeFields("pricing")).toEqual(["price", "total"]);
    expect(registry.getComputedEntries().map((entry) => entry.path)).toEqual([
      "total",
    ]);
    expect(registry.getTransformEntries().map(([path]) => path)).toEqual([
      "name",
    ]);
    expect(registry.getNormalizerEntries().map((entry) => entry.path)).toEqual([
      "name",
    ]);

    registry.unregister("total");

    expect(registry.getScopeFields("pricing")).toEqual(["price"]);
    expect(registry.getComputedEntries()).toHaveLength(0);
  });
});
