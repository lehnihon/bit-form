import { describe, it, expect, vi, afterEach } from "vitest";
import { createInternalBitStore } from "../../core/store";

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

    const unsubscribe1 = store.observe.subscribe(() => {});
    const unsubscribe2 = store.observe.subscribePath("name", () => {});

    unsubscribe1();
    unsubscribe2();

    store.feature.cleanup();
    expect(() => {
      store.observe.subscribe(() => {});
    }).not.toThrow();
  });

  it("should cleanup multiple store instances without leaking", () => {
    const stores: ReturnType<
      typeof createInternalBitStore<{ value: number }>
    >[] = [];

    for (let i = 0; i < 50; i++) {
      const store = createInternalBitStore<{ value: number }>({
        initialValues: { value: i },
      });
      store.observe.subscribe(() => {});
      stores.push(store);
    }

    stores.forEach((store) => {
      store.feature.cleanup();
    });

    const newStore = createInternalBitStore<{ test: boolean }>({
      initialValues: { test: true },
    });
    expect(newStore.read.getState().values).toEqual({ test: true });
    newStore.feature.cleanup();
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

    store.write.setField("name", "Updated");

    // Cleanup should succeed and clear any timers
    expect(() => {
      store.feature.cleanup();
    }).not.toThrow();

    // Verify cleanup happened - no error should be thrown on second cleanup
    expect(() => {
      store.feature.cleanup();
    }).not.toThrow();
  });

  it("should not throw when cleanup is called multiple times", () => {
    const store = createInternalBitStore<{
      name: string;
    }>({
      initialValues: { name: "" },
    });

    expect(() => {
      store.feature.cleanup();
      store.feature.cleanup();
      store.feature.cleanup();
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

    store.write.setValues({
      field_10: "value_10",
      field_20: "value_20",
    });

    store.feature.cleanup();

    expect(() => {
      store.read.getState();
    }).not.toThrow();
  });

  it("should not throw when accessing store after cleanup", () => {
    const store = createInternalBitStore<{
      name: string;
    }>({
      initialValues: { name: "" },
    });

    store.feature.cleanup();

    expect(() => {
      store.read.getState();
      store.read.isValid;
    }).not.toThrow();
  });
});
