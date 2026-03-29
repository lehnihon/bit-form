import { describe, it, expect, vi } from "vitest";
import { createPatternMask, unmaskCurrency } from "../../core/mask/creators";
import { createBitStore as createBitStoreRuntime } from "../../core";

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

describe("Form Lifecycle Flow", () => {
  it("should process the full complex lifecycle including dependencies and array remapping", async () => {
    let store: any;

    const mockResolver = vi.fn().mockImplementation(() => {
      const errors = store.getState().errors;
      return Object.keys(errors).length > 0 ? errors : {};
    });

    store = createBitStore({
      initialValues: {
        coupon: "",
        price: "",
        items: [{ id: 1, val: "" }],
        showAdvanced: false,
        secretKey: "HIDDEN",
      },
      validation: { resolver: mockResolver },
      fields: {
        price: { transform: (v) => unmaskCurrency(v) },
      },
    });

    store.registerField("secretKey", {
      conditional: {
        dependsOn: ["showAdvanced"],
        showIf: (v: any) => v.showAdvanced === true,
      },
    });

    store.setField("coupon", createPatternMask("UUUU-##").format("save20"));
    store.setField("price", "R$ 1.500,90");

    store.pushItem("items", { id: 2, val: "ok" });
    store.setError("items.1.val", "Invalid item");
    store.removeItem("items", 0);

    expect(store.getState().values.coupon).toBe("SAVE-20");
    expect(store.getState().errors["items.0.val"]).toBe("Invalid item");

    store.setField("items.0.val", "fixed");
    store.setField("showAdvanced", true);

    let finalPayload: any = null;
    await store.submit((values: any) => {
      finalPayload = values;
    });

    expect(finalPayload.coupon).toBe("SAVE-20");
    expect(finalPayload.price).toBe(1500.9);
    expect(finalPayload.items).toHaveLength(1);
    expect(finalPayload.secretKey).toBe("HIDDEN");

    store.setField("showAdvanced", false);
    await store.submit((values: any) => {
      finalPayload = values;
    });

    expect(finalPayload.secretKey).toBeUndefined();
  });
});
