import { describe, expect, it, vi } from "vitest";
import { createBitStore as createBitStoreRuntime } from "../../core";
import { createPatternMask } from "../../core/mask/creators";
import { maskBRL } from "../../mask";

function createBitStore<T extends object = Record<string, unknown>>(
  config?: any,
) {
  return createBitStoreRuntime<T>(config) as any;
}

describe("Cross-Framework Consistency", () => {
  it("should maintain data integrity and case sensitivity across adapters", async () => {
    const store = createBitStore({ initialValues: { apiKey: "" } });
    const mask = createPatternMask("XXXX-####");
    const formatted = mask.format("test1234");

    store.write.setField("apiKey", formatted);
    expect(store.read.getState().values.apiKey).toBe("test-1234");

    await store.write.submit((values: any) => {
      expect(values.apiKey).toBe("test-1234");
    });
  });

  it("should exhibit identical behavior for currency between frameworks", () => {
    const store = createBitStore({
      initialValues: { balance: 10 },
      masks: { brl: maskBRL },
    });
    const brl = store.read.config.masks!.brl;

    const display = brl.format(store.read.getState().values.balance);
    expect(display).toBe("R$ 10,00");

    const parsed = brl.parse("R$ 50,00");
    expect(parsed).toBe(50);
  });

  it("should handle array error shifting and value integrity consistently", () => {
    const store = createBitStore({ initialValues: { list: ["A", "B", "C"] } });
    store.feature.triggerValidation = vi.fn();

    store.write.setError("list.2", "Error C");
    store.feature.removeItem("list", 1);

    expect(store.read.getState().values.list).toEqual(["A", "C"]);
    expect(store.read.getState().errors["list.1"]).toBe("Error C");

    store.feature.moveItem("list", 1, 0);
    expect(store.read.getState().values.list).toEqual(["C", "A"]);
    expect(store.read.getState().errors["list.0"]).toBe("Error C");
  });

  it("should evaluate conditional visibility and requirement consistently", () => {
    const store = createBitStore({ initialValues: { type: "A", detail: "" } });

    store.feature.registerField("detail", {
      conditional: {
        dependsOn: ["type"],
        showIf: (v: any) => v.type === "B",
        requiredIf: (v: any) => v.type === "B",
      },
    });

    expect(store.read.isHidden("detail")).toBe(true);
    store.write.setField("type", "B");
    expect(store.read.isHidden("detail")).toBe(false);
  });

  it("should apply transforms consistently before submission", async () => {
    const store = createBitStore({
      initialValues: { count: 10 },
      fields: { count: { transform: (v: number) => v * 2 } },
    });

    let result: any;
    await store.write.submit((values: any) => {
      result = values;
    });
    expect(result.count).toBe(20);
  });
});
