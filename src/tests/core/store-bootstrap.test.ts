import { describe, it, expect } from "vitest";
import { normalizeConfig } from "../../core/store/shared/config";
import { BitFieldRegistry } from "../../core/store/registry/field-registry";
import { BitComputedManager } from "../../core/store/managers/core/computed-manager";
import { createInitialStoreState } from "../../core/store/orchestration/store-bootstrap";

describe("createInitialStoreState", () => {
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
