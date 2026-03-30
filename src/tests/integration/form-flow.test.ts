import { describe, expect, it, vi } from "vitest";
import { createBitStore as createBitStoreRuntime } from "../../core";
import { createPatternMask, unmaskCurrency } from "../../core/mask/creators";

function createBitStore<T extends object = Record<string, unknown>>(
  config?: any,
) {
  return createBitStoreRuntime<T>(config) as any;
}

describe("Form Lifecycle Flow", () => {
  it("should process the full complex lifecycle including dependencies and array remapping", async () => {
    let store: any;

    const mockResolver = vi.fn().mockImplementation(() => {
      const errors = store.read.getState().errors;
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

    store.feature.registerField("secretKey", {
      conditional: {
        dependsOn: ["showAdvanced"],
        showIf: (v: any) => v.showAdvanced === true,
      },
    });

    store.write.setField(
      "coupon",
      createPatternMask("UUUU-##").format("save20"),
    );
    store.write.setField("price", "R$ 1.500,90");

    store.feature.pushItem("items", { id: 2, val: "ok" });
    store.write.setError("items.1.val", "Invalid item");
    store.feature.removeItem("items", 0);

    expect(store.read.getState().values.coupon).toBe("SAVE-20");
    expect(store.read.getState().errors["items.0.val"]).toBe("Invalid item");

    store.write.setField("items.0.val", "fixed");
    store.write.setField("showAdvanced", true);

    let finalPayload: any = null;
    await store.write.submit((values: any) => {
      finalPayload = values;
    });

    expect(finalPayload.coupon).toBe("SAVE-20");
    expect(finalPayload.price).toBe(1500.9);
    expect(finalPayload.items).toHaveLength(1);
    expect(finalPayload.secretKey).toBe("HIDDEN");

    store.write.setField("showAdvanced", false);
    await store.write.submit((values: any) => {
      finalPayload = values;
    });

    expect(finalPayload.secretKey).toBeUndefined();
  });
});
