import { describe, it, expect } from "vitest";
import { normalizeConfig } from "../../core/store/config";
import { BitDependencyManager } from "../../core/store/dependency-manager";
import { BitComputedManager } from "../../core/store/computed-manager";
import { createInitialStoreState } from "../../core/store/store-bootstrap";

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

    const depsMg = new BitDependencyManager<any>();
    const computedMg = new BitComputedManager<any>(() => {
      const entries: [string, (values: any) => any][] = [];
      depsMg.fieldConfigs.forEach((fieldConfig, path) => {
        if (fieldConfig.computed) {
          entries.push([path, fieldConfig.computed]);
        }
      });
      return entries;
    });

    const initialState = createInitialStoreState({
      config,
      depsMg,
      computedMg,
    });

    expect(initialState.values.total).toBe(20);
    expect(depsMg.fieldConfigs.has("total")).toBe(true);
    expect(depsMg.fieldConfigs.has("extra")).toBe(true);
    expect(depsMg.isHidden("extra")).toBe(true);
  });
});
