import { describe, it, expect } from "vitest";
import { BitStore } from "bit-form/core/bit-store";
import { createPatternMask, unmask } from "bit-form/core/mask-utils";

describe("Cross-Framework Consistency", () => {
  it("should maintain data integrity and case sensitivity across adapters", async () => {
    const store = new BitStore({
      initialValues: { apiKey: "" },
      transform: { apiKey: unmask },
    });

    const mask = createPatternMask("XXXX-####");
    const maskedValue = mask("test1234");
    store.setField("apiKey", maskedValue);
    const state = store.getState();
    expect(state.values.apiKey).toBe("test-1234");
    await store.submit((values) => {
      expect(values.apiKey).toBe("test1234");
    });
  });
});
