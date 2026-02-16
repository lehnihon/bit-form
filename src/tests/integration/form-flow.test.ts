import { describe, it, expect, vi } from "vitest";
import { BitStore, createPatternMask, unmaskCurrency } from "../../core";

describe("Form Lifecycle Flow", () => {
  it("should process the full complex lifecycle including dependencies and array remapping", async () => {
    let store: any;

    const mockResolver = vi.fn().mockImplementation(() => {
      const errors = store.getState().errors;
      return Object.keys(errors).length > 0 ? errors : {};
    });

    store = new BitStore({
      initialValues: {
        coupon: "",
        price: "",
        items: [{ id: 1, val: "" }],
        showAdvanced: false,
        secretKey: "HIDDEN",
      },
      resolver: mockResolver,
      transform: { price: (v) => unmaskCurrency(v) },
    });

    store.registerConfig("secretKey", {
      dependsOn: ["showAdvanced"],
      showIf: (v: any) => v.showAdvanced === true,
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
