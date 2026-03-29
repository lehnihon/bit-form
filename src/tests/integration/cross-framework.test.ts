import { describe, it, expect, vi } from "vitest";
import { createPatternMask } from "../../core/mask/creators";
import { createBitStore as createBitStoreRuntime } from "../../core";
import { maskBRL } from "../../mask";

function adaptToLegacyFlat(store: any) {
  const legacyStore = Object.create(store);

  return Object.assign(legacyStore, {
    getState: () => store.read.getState(),
    getConfig: () => store.read.getConfig(),
    getFieldState: (path: any) => store.read.getFieldState(path),
    isHidden: (path: any) => store.read.isHidden(path),
    isRequired: (path: any) => store.read.isRequired(path),
    setField: (path: any, value: any) => store.write.setField(path, value),
    blurField: (path: any) => store.write.blurField(path),
    setError: (path: any, error: any) => store.write.setError(path, error),
    clearError: (path: any) => store.write.clearError(path),
    validate: () => store.write.validate(),
    submit: (handler: any) => store.write.submit(handler),
    reset: () => store.write.reset(),
    registerField: (path: any, config: any) =>
      store.feature.registerField(path, config),
    unregisterField: (path: any) => store.feature.unregisterField(path),
    pushItem: (path: any, item: any) => store.feature.pushItem(path, item),
    removeItem: (path: any, index: any) =>
      store.feature.removeItem(path, index),
    moveItem: (path: any, from: any, to: any) =>
      store.feature.moveItem(path, from, to),
    subscribe: (cb: any) => store.observe.subscribe(cb),
    subscribeField: (path: any, cb: any) =>
      store.observe.subscribeField(path, cb),
  });
}

function createBitStore<T extends object = Record<string, unknown>>(
  config?: any,
) {
  return adaptToLegacyFlat(createBitStoreRuntime<T>(config)) as any;
}

describe("Cross-Framework Consistency", () => {
  it("should maintain data integrity and case sensitivity across adapters", async () => {
    const store = createBitStore({ initialValues: { apiKey: "" } });
    const mask = createPatternMask("XXXX-####");
    const formatted = mask.format("test1234");

    store.setField("apiKey", formatted);
    expect(store.getState().values.apiKey).toBe("test-1234");

    await store.submit((values: any) => {
      expect(values.apiKey).toBe("test-1234");
    });
  });

  it("should exhibit identical behavior for currency between frameworks", () => {
    const store = createBitStore({
      initialValues: { balance: 10 },
      masks: { brl: maskBRL },
    });
    const brl = store.getConfig().masks!.brl;

    const display = brl.format(store.getState().values.balance);
    expect(display).toBe("R$ 10,00");

    const parsed = brl.parse("R$ 50,00");
    expect(parsed).toBe(50);
  });

  it("should handle array error shifting and value integrity consistently", () => {
    const store = createBitStore({ initialValues: { list: ["A", "B", "C"] } });
    (store as any).triggerValidation = vi.fn();

    store.setError("list.2", "Error C");
    store.removeItem("list", 1);

    expect(store.getState().values.list).toEqual(["A", "C"]);
    expect(store.getState().errors["list.1"]).toBe("Error C");

    store.moveItem("list", 1, 0);
    expect(store.getState().values.list).toEqual(["C", "A"]);
    expect(store.getState().errors["list.0"]).toBe("Error C");
  });

  it("should evaluate conditional visibility and requirement consistently", () => {
    const store = createBitStore({ initialValues: { type: "A", detail: "" } });

    store.registerField("detail", {
      conditional: {
        dependsOn: ["type"],
        showIf: (v: any) => v.type === "B",
        requiredIf: (v: any) => v.type === "B",
      },
    });

    expect(store.isHidden("detail")).toBe(true);
    store.setField("type", "B");
    expect(store.isHidden("detail")).toBe(false);
  });

  it("should apply transforms consistently before submission", async () => {
    const store = createBitStore({
      initialValues: { count: 10 },
      fields: { count: { transform: (v: number) => v * 2 } },
    });

    let result: any;
    await store.submit((values: any) => {
      result = values;
    });
    expect(result.count).toBe(20);
  });
});
