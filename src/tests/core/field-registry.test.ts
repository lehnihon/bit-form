import { describe, expect, it, vi } from "vitest";
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

    const values = { price: 10, total: 0, name: "", items: [] };

    expect(registry.getScopeFields("pricing", values)).toEqual(["price", "total"]);
    expect(registry.getComputedEntries(values).map((entry) => entry.path)).toEqual([
      "total",
    ]);
    expect(registry.getTransformEntries(values).map(([path]) => path)).toEqual([
      "name",
    ]);
    expect(registry.getNormalizerEntries(values).map((entry) => entry.path)).toEqual([
      "name",
    ]);

    registry.unregister("total");

    expect(registry.getScopeFields("pricing", values)).toEqual(["price"]);
    expect(registry.getComputedEntries(values)).toHaveLength(0);
  });

  it("não deve quebrar evaluateAll quando showIf lança erro", () => {
    const onConditionError = vi.fn();
    const registry = new BitFieldRegistry<{ toggle: boolean; guarded: string }>(
      onConditionError,
    );

    registry.register(
      "guarded",
      {
        conditional: {
          dependsOn: ["toggle"],
          showIf: () => {
            throw new Error("broken-showIf");
          },
        },
      },
      { toggle: false, guarded: "" },
    );

    expect(() =>
      registry.evaluateAll({ toggle: true, guarded: "" }),
    ).not.toThrow();
    expect(onConditionError).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "guarded",
        kind: "showIf",
      }),
    );
  });

  it("isRequired deve retornar false quando requiredIf lança erro", () => {
    const onConditionError = vi.fn();
    const registry = new BitFieldRegistry<{ mode: string; doc: string }>(
      onConditionError,
    );

    registry.register(
      "doc",
      {
        conditional: {
          dependsOn: ["mode"],
          requiredIf: () => {
            throw new Error("broken-requiredIf");
          },
        },
      },
      { mode: "on", doc: "" },
    );

    expect(registry.isRequired("doc", { mode: "on", doc: "" })).toBe(false);
    expect(onConditionError).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "doc",
        kind: "requiredIf",
      }),
    );
  });

  it("re-register deve substituir dependências antigas do mesmo path", () => {
    const registry = new BitFieldRegistry<{
      a: boolean;
      b: boolean;
      x: string;
    }>();

    const currentValues = { a: false, b: false, x: "" };

    registry.register(
      "x",
      {
        conditional: {
          dependsOn: ["a"],
          showIf: (values) => values.a,
        },
      },
      currentValues,
    );

    registry.register(
      "x",
      {
        conditional: {
          dependsOn: ["b"],
          showIf: (values) => values.b,
        },
      },
      currentValues,
    );

    const diffFromA = registry.updateDependencies("a", currentValues, {
      ...currentValues,
      a: true,
    });
    expect(diffFromA.affectedFields).not.toContain("x");

    const diffFromB = registry.updateDependencies("b", currentValues, {
      ...currentValues,
      b: true,
    });
    expect(diffFromB.affectedFields).toContain("x");
  });

  it("re-register de dependency key deve preservar campos que dependem dela", () => {
    const registry = new BitFieldRegistry<{
      trigger: boolean;
      dep: boolean;
      sink: string;
    }>();

    const currentValues = { trigger: false, dep: false, sink: "" };

    registry.register(
      "sink",
      {
        conditional: {
          dependsOn: ["dep"],
          showIf: (values) => values.dep,
        },
      },
      currentValues,
    );

    registry.register(
      "dep",
      {
        conditional: {
          dependsOn: ["trigger"],
          showIf: (values) => values.trigger,
        },
      },
      currentValues,
    );

    // Re-register dependency key with a different config.
    registry.register(
      "dep",
      {
        conditional: {
          dependsOn: ["trigger"],
          showIf: (values) => !values.trigger,
        },
      },
      currentValues,
    );

    const diffFromDep = registry.updateDependencies("dep", currentValues, {
      ...currentValues,
      dep: true,
    });

    expect(diffFromDep.affectedFields).toContain("sink");
  });

  it("re-register com ciclo deve manter comportamento anterior via rollback", () => {
    const onConditionError = vi.fn();
    const registry = new BitFieldRegistry<{
      gate: boolean;
      peer: boolean;
      target: string;
    }>(onConditionError);

    const currentValues = { gate: false, peer: false, target: "" };

    registry.register(
      "target",
      {
        conditional: {
          dependsOn: ["gate"],
          showIf: (values) => values.gate,
        },
      },
      currentValues,
    );

    // Valid re-register first.
    registry.register(
      "target",
      {
        conditional: {
          dependsOn: ["peer"],
          showIf: (values) => values.peer,
        },
      },
      currentValues,
    );

    // This re-register would create cycle (target -> peer, peer -> target).
    registry.register(
      "peer",
      {
        conditional: {
          dependsOn: ["target"],
          showIf: (values) => values.target.length > 0,
        },
      },
      currentValues,
    );

    registry.register(
      "target",
      {
        conditional: {
          dependsOn: ["peer"],
          showIf: (values) => values.peer,
        },
      },
      currentValues,
    );

    const diffFromPeer = registry.updateDependencies("peer", currentValues, {
      ...currentValues,
      peer: true,
    });

    expect(onConditionError).toHaveBeenCalled();
    expect(diffFromPeer.affectedFields).toContain("target");
  });
});
