import { describe, expect, it } from "vitest";
import { BitComputedManager } from "../../core/store/managers/core/computed-manager";
import { createInitialStoreState } from "../../core/store/orchestration/store-bootstrap";
import { BitFieldRegistry } from "../../core/store/registry/field-registry";
import { normalizeConfig } from "../../core/store/shared/config";

describe("createInitialStoreState", () => {
  it("não quebra quando initialValues contém função não clonável via structuredClone", () => {
    expect(() =>
      normalizeConfig({
        initialValues: {
          amount: 10,
          formatter: () => "$10.00",
        },
      }),
    ).not.toThrow();
  });

  it("preserva Map e Set em initialValues quando structuredClone não existe", () => {
    const globalScope = globalThis as {
      structuredClone?: <V>(value: V) => V;
    };
    const originalStructuredClone = globalScope.structuredClone;

    Object.defineProperty(globalScope, "structuredClone", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    try {
      const config = normalizeConfig({
        initialValues: {
          metadata: new Map([["version", 1]]),
          tags: new Set(["core"]),
        },
      });

      expect(config.initialValues.metadata).toBeInstanceOf(Map);
      expect(config.initialValues.tags).toBeInstanceOf(Set);
      expect(config.initialValues.metadata.get("version")).toBe(1);
      expect([...config.initialValues.tags]).toEqual(["core"]);
    } finally {
      Object.defineProperty(globalScope, "structuredClone", {
        value: originalStructuredClone,
        writable: true,
        configurable: true,
      });
    }
  });

  it("registra fields iniciais e aplica computeds", () => {
    const config = normalizeConfig({
      initialValues: {
        price: 10,
        total: 0,
        showExtra: false,
        extra: "x",
      },
      fields: {
        total: {
          computed: (values: any) => values.price * 2,
          computedDependsOn: ["price"],
        },
        extra: {
          conditional: {
            dependsOn: ["showExtra"],
            showIf: (values: any) => values.showExtra,
          },
        },
      },
    });

    const fieldRegistry = new BitFieldRegistry<any>();
    const computedManager = new BitComputedManager<any>(() => {
      const entries: Array<{
        path: string;
        compute: (values: any) => any;
        dependsOn: string[];
      }> = [];
      fieldRegistry.forEachFieldConfig((fieldConfig, path) => {
        if (fieldConfig.computed) {
          entries.push({
            path,
            compute: fieldConfig.computed,
            dependsOn: fieldConfig.computedDependsOn,
          });
        }
      });
      return entries;
    });

    const initialState = createInitialStoreState({
      config,
      fieldRegistry,
      computedManager,
    });

    expect(initialState.values.total).toBe(20);
    expect(fieldRegistry.hasFieldConfig("total")).toBe(true);
    expect(fieldRegistry.hasFieldConfig("extra")).toBe(true);
    expect(fieldRegistry.isHidden("extra")).toBe(true);
  });
});
