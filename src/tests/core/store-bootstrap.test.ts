import { describe, it, expect } from "vitest";
import { normalizeConfig } from "../../core/store/shared/config";
import { BitDependencyManager } from "../../core/store/managers/core/dependency-manager";
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
        },
        extra: {
          conditional: {
            dependsOn: ["showExtra"],
            showIf: (values: any) => values.showExtra,
          },
        },
      },
    });

    const dependencyManager = new BitDependencyManager<any>();
    const computedManager = new BitComputedManager<any>(() => {
      const entries: [string, (values: any) => any][] = [];
      dependencyManager.forEachFieldConfig((fieldConfig, path) => {
        if (fieldConfig.computed) {
          entries.push([path, fieldConfig.computed]);
        }
      });
      return entries;
    });

    const initialState = createInitialStoreState({
      config,
      dependencyManager,
      computedManager,
    });

    expect(initialState.values.total).toBe(20);
    expect(dependencyManager.hasFieldConfig("total")).toBe(true);
    expect(dependencyManager.hasFieldConfig("extra")).toBe(true);
    expect(dependencyManager.isHidden("extra")).toBe(true);
  });
});
