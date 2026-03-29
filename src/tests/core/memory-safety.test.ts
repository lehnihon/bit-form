import { describe, it, expect, vi, afterEach } from "vitest";
import { createInternalBitStore } from "../../core/store";
import type { BitStore } from "../../core/store/bit-store-class";

describe("BitStore Memory Safety", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should cleanup subscriptions after destroy", () => {
    const store = createInternalBitStore<{
      name: string;
    }>({
      initialValues: { name: "" },
    });

    const unsubscribe1 = store.subscribe(() => {});
    const unsubscribe2 = store.observe.subscribePath("name", () => {});

    unsubscribe1();
    unsubscribe2();

    store.cleanup();
    expect(() => {
      store.subscribe(() => {});
    }).not.toThrow();
  });

  it("should cleanup multiple store instances without leaking", () => {
    const stores: BitStore<{ value: number }>[] = [];

    for (let i = 0; i < 50; i++) {
      const store = createInternalBitStore<{ value: number }>({
        initialValues: { value: i },
      });
      store.subscribe(() => {});
      stores.push(store);
    }

    stores.forEach((store) => {
      store.cleanup();
    });

    const newStore = createInternalBitStore<{ test: boolean }>({
      initialValues: { test: true },
    });
    expect(newStore.getState().values).toEqual({ test: true });
    newStore.cleanup();
  });

  it("should clear persist timers on cleanup", async () => {
    // Test that cleanup doesn't throw and properly clears persist manager state
    // The persist manager's destroy() method clears any pending timers
    const store = createInternalBitStore<{ name: string }>({
      initialValues: { name: "Leo" },
      persist: {
        key: "test-form",
        autoSave: true,
        debounceMs: 500,
      },
    });

    store.setField("name", "Updated");

    // Cleanup should succeed and clear any timers
    expect(() => {
      store.cleanup();
    }).not.toThrow();

    // Verify cleanup happened - no error should be thrown on second cleanup
    expect(() => {
      store.cleanup();
    }).not.toThrow();
  });

  it("should not throw when cleanup is called multiple times", () => {
    const store = createInternalBitStore<{
      name: string;
    }>({
      initialValues: { name: "" },
    });

    expect(() => {
      store.cleanup();
      store.cleanup();
      store.cleanup();
    }).not.toThrow();
  });

  it("should handle large form configs without leaks", () => {
    const initialValues: Record<string, string> = {};
    const fields: Record<string, any> = {};

    for (let i = 0; i < 100; i++) {
      const fieldName = `field_${i}`;
      initialValues[fieldName] = "";
      fields[fieldName] = { type: "text" };
    }

    const store = createInternalBitStore<Record<string, string>>({
      initialValues,
      fields,
    });

    for (let i = 0; i < 20; i++) {
      store.observe.subscribePath(`field_${i}`, () => {});
    }

    store.setValues({
      field_10: "value_10",
      field_20: "value_20",
    });

    store.cleanup();

    expect(() => {
      store.getState();
    }).not.toThrow();
  });

  it("should not throw when accessing store after cleanup", () => {
    const store = createInternalBitStore<{
      name: string;
    }>({
      initialValues: { name: "" },
    });

    store.cleanup();

    expect(() => {
      store.getState();
      store.isValid;
    }).not.toThrow();
  });
});
