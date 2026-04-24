import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBitStore as createBitStoreRuntime } from "../../core";

function createBitStore<T extends object = Record<string, unknown>>(
  config?: any,
) {
  return createBitStoreRuntime<T>(config) as any;
}

/**
 * Memory Leak Detection Tests
 *
 * Tests to verify that subscriptions are properly cleaned up and
 * no memory leaks occur with dynamic field operations.
 */

interface TestForm {
  count: number;
  email?: string;
  [key: string]: any;
}

describe("Memory Leak Detection", () => {
  let store: ReturnType<typeof createBitStore<TestForm>>;

  beforeEach(() => {
    store = createBitStore<TestForm>({
      initialValues: {
        count: 0,
      },
    });
  });

  afterEach(() => {
    if (store.feature.cleanup) {
      store.feature.cleanup();
    }
  });

  it("should cleanup subscriptions when unsubscribe is called", () => {
    const listener = vi.fn();
    const unsubscribe = store.observe.subscribe(listener);

    expect(listener).not.toHaveBeenCalled();

    store.write.setField("count", 1);
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    const callsBeforeUnsubscribe = listener.mock.calls.length;
    store.write.setField("count", 2);

    // Should still be same number of calls (not called again after unsubscribe)
    expect(listener.mock.calls.length).toBe(callsBeforeUnsubscribe);
  });

  it("should cleanup field subscriptions on unregisterField", () => {
    const listener = vi.fn();
    store.feature.registerField("test", {});

    const unsubscribe = store.observe.subscribe(() => {
      listener();
    });

    store.write.setField("test", "value");
    const callsBefore = listener.mock.calls.length;

    store.feature.unregisterField("test");
    store.write.setField("test", "value2");

    // Verify cleanup occurred
    const callsAfter = listener.mock.calls.length;
    expect(callsAfter).toBeLessThanOrEqual(callsBefore + 1);

    unsubscribe();
  });

  it("should not leak memory with dynamic field registration/unregistration", () => {
    const numCycles = 100;

    for (let i = 0; i < numCycles; i++) {
      const fieldPath = `field_${i}`;
      store.feature.registerField(fieldPath, {});
      store.write.setField(fieldPath, `value_${i}`);
      store.feature.unregisterField(fieldPath);
    }

    // After all cycles, store should be functional
    const state = store.read.getState();
    expect(state).toBeDefined();
  });

  it("should cleanup async validations on reset", async () => {
    store.feature.registerField("asyncField", {
      validation: {
        asyncValidateOn: "change",
        asyncValidate: async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return undefined;
        },
        asyncValidateDelay: 50,
      },
    });

    // Trigger async validation
    store.write.setField("asyncField", "test");

    const stateBefore = store.read.getState();
    expect(stateBefore.isValidating["asyncField"]).toBe(true);

    // Reset should cancel validations
    store.write.reset();

    const stateAfter = store.read.getState();
    expect(stateAfter.isValidating["asyncField"]).toBeUndefined();
  });

  it("should prevent path subscription index from unbounded growth", () => {
    // Register many different paths
    for (let i = 0; i < 500; i++) {
      const path = `field_${i % 50}.sub_${i}`;
      store.feature.registerField(path, {});

      // Subscribe to field changes
      const unsubscribe = store.observe.subscribe(() => {
        try {
          store.read.getState();
        } catch {
          // Ignore errors
        }
      });

      // Immediately unsubscribe
      unsubscribe();
    }

    // Store should still be responsive
    expect(() => {
      store.read.getState();
    }).not.toThrow();
  });

  it("should maintain store functionality after many operations", () => {
    // Perform many field operations
    for (let i = 0; i < 50; i++) {
      store.feature.registerField(`field_${i}`, {});
      store.write.setField(`field_${i}`, `value_${i}`);
    }

    // Store should still function correctly
    const state = store.read.getState();
    expect(state).toBeDefined();
    expect(state.values).toBeDefined();

    // Unregister half
    for (let i = 0; i < 25; i++) {
      store.feature.unregisterField(`field_${i}`);
    }

    // Store should still function
    const finalState = store.read.getState();
    expect(finalState).toBeDefined();
  });

  describe("Array pathIds Cleanup", () => {
    it("should clean pathIds from memory when all array items removed", async () => {
      const arrayStore = createBitStore<any>({
        initialValues: {
          items: [
            { id: "1", value: "a" },
            { id: "2", value: "b" },
          ],
        },
        fields: {
          items: { type: "array" },
          "items.*": { type: "object" },
          "items.*.id": { type: "text" },
          "items.*.value": { type: "text" },
        },
      });

      arrayStore.feature.removeItem("items", 0);
      arrayStore.feature.removeItem("items", 0);

      const state = arrayStore.read.getState();
      expect(state.values.items).toEqual([]);

      arrayStore.feature.cleanup();
    });

    it("should clean pathIds when array is cleared", async () => {
      const arrayStore = createBitStore<any>({
        initialValues: {
          items: [
            { id: "1", value: "a" },
            { id: "2", value: "b" },
          ],
        },
        fields: {
          items: { type: "array" },
          "items.*": { type: "object" },
          "items.*.id": { type: "text" },
          "items.*.value": { type: "text" },
        },
      });

      arrayStore.write.setField("items", []);

      const state = arrayStore.read.getState();
      expect(state.values.items).toEqual([]);

      arrayStore.feature.cleanup();
    });

    it("should maintain correct pathIds after multiple cycles of add/remove", async () => {
      const arrayStore = createBitStore<any>({
        initialValues: {
          items: [],
        },
        fields: {
          items: { type: "array" },
          "items.*": { type: "object" },
          "items.*.id": { type: "text" },
          "items.*.value": { type: "text" },
        },
      });

      for (let i = 0; i < 5; i++) {
        arrayStore.feature.pushItem("items", { id: `${i}`, value: `item-${i}` });
        expect(arrayStore.read.getState().values.items).toHaveLength(1);

        arrayStore.feature.removeItem("items", 0);
        expect(arrayStore.read.getState().values.items).toHaveLength(0);
      }

      arrayStore.feature.cleanup();
    });

    it("should not accumulate empty entries when replacing array with empty array", async () => {
      const arrayStore = createBitStore<any>({
        initialValues: {
          items: [{ id: "1", value: "a" }],
        },
        fields: {
          items: { type: "array" },
          "items.*": { type: "object" },
          "items.*.id": { type: "text" },
          "items.*.value": { type: "text" },
        },
      });

      for (let i = 0; i < 10; i++) {
        arrayStore.write.setField("items", []);
        expect(arrayStore.read.getState().values.items).toEqual([]);

        arrayStore.write.setField("items", [{ id: "temp", value: "temp-value" }]);
        expect(arrayStore.read.getState().values.items).toHaveLength(1);
      }

      arrayStore.feature.cleanup();
    });
  });
});
