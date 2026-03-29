import { describe, it, expect, vi, afterEach } from "vitest";
import { createBitStore } from "../../core/store/orchestration/create-store";
import { BitStore } from "../../core/store/bit-store-class";

describe("BitStore Memory Safety", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should cleanup subscriptions after destroy", () => {
    const store = createBitStore({ initialValues: { name: "" } }) as any as BitStore<{
      name: string;
    }>;

    const unsubscribe1 = store.subscribe(() => {});
    const unsubscribe2 = store.observe.subscribeSelector(
      (state) => state.values,
      () => {},
    );

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
      const store = createBitStore({
        initialValues: { value: i },
      }) as any as BitStore<{ value: number }>;
      store.subscribe(() => {});
      stores.push(store);
    }

    stores.forEach((store) => {
      store.cleanup();
    });

    const newStore = createBitStore({
      initialValues: { test: true },
    }) as any as BitStore<{ test: boolean }>;
    expect(newStore.getState().values).toEqual({ test: true });
    newStore.cleanup();
  });

  it("should clear persist timers on cleanup", async () => {
    vi.useFakeTimers();

    const store = createBitStore({
      initialValues: { name: "Leo" },
      persist: {
        key: "test-form",
        autoSave: true,
        debounceMs: 500,
      },
    }) as any as BitStore<{ name: string }>;

    store.setField("name", "Updated");

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    store.cleanup();

    const pendingCount = vi.getTimerCount();
    expect(pendingCount).toBe(0);

    vi.useRealTimers();
  });

  it("should not throw when cleanup is called multiple times", () => {
    const store = createBitStore({ initialValues: { name: "" } }) as any as BitStore<{
      name: string;
    }>;

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

    const store = createBitStore({
      initialValues,
      fields,
    }) as any as BitStore<Record<string, string>>;

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
    const store = createBitStore({ initialValues: { name: "" } }) as any as BitStore<{
      name: string;
    }>;

    store.cleanup();

    expect(() => {
      store.getState();
      store.isValid;
    }).not.toThrow();
  });
});
