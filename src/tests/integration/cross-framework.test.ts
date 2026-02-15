import { describe, it, expect } from "vitest";
import { BitStore, createPatternMask } from "../../core";

describe("Cross-Framework Consistency", () => {
  it("should maintain data integrity and case sensitivity across adapters", async () => {
    const store = new BitStore({
      initialValues: { apiKey: "" },
    });

    const mask = createPatternMask("XXXX-####");

    const formatted = mask.format("test1234");
    expect(formatted).toBe("test-1234");

    store.setField("apiKey", formatted);

    const state = store.getState();
    expect(state.values.apiKey).toBe("test-1234");

    await store.submit((values) => {
      expect(values.apiKey).toBe("test-1234");
    });
  });

  it("should exhibit identical behavior for currency between frameworks", () => {
    const store = new BitStore({
      initialValues: { balance: 10 },
    });

    const brl = store.masks.brl;

    const display = brl.format(store.getState().values.balance);
    expect(display).toBe("R$ 10,00");

    const parsed = brl.parse("R$ 50,00");
    expect(parsed).toBe(50);
  });
});
