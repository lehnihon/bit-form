import { describe, it, expect, vi } from "vitest";
import { BitStore, createPatternMask, unmaskCurrency } from "../../core";

describe("Form Lifecycle Flow", () => {
  it("should process the full lifecycle from raw input to unmasked data", async () => {
    const mockResolver = vi.fn().mockResolvedValue({});

    const store = new BitStore({
      initialValues: {
        coupon: "",
        price: "",
      },
      resolver: mockResolver,
      transform: {
        price: (v) => unmaskCurrency(v),
      },
    });

    const couponMask = createPatternMask("UUUU-##");

    store.setField("coupon", couponMask.format("save20"));
    store.setField("price", "R$ 1.500,90");

    expect(store.getState().values.coupon).toBe("SAVE-20");
    expect(store.getState().values.price).toBe("R$ 1.500,90");

    let finalPayload: any = null;
    await store.submit((values) => {
      finalPayload = values;
    });

    expect(finalPayload).toEqual({
      coupon: "SAVE-20",
      price: 1500.9,
    });

    expect(mockResolver).toHaveBeenCalled();
    expect(store.getState().isSubmitting).toBe(false);
  });
});
