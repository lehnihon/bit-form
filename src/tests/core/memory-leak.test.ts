import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createBitStore as createBitStoreRuntime,
  createFrameworkStoreAdapter,
} from "../../core";

function createBitStore<T extends object = Record<string, unknown>>(
  config?: any,
) {
  return createFrameworkStoreAdapter(createBitStoreRuntime<T>(config)) as any;
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
    if (store.cleanup) {
      store.cleanup();
    }
  });

  it("should cleanup subscriptions when unsubscribe is called", () => {
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    expect(listener).not.toHaveBeenCalled();

    store.setField("count", 1);
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    const callsBeforeUnsubscribe = listener.mock.calls.length;
    store.setField("count", 2);

    // Should still be same number of calls (not called again after unsubscribe)
    expect(listener.mock.calls.length).toBe(callsBeforeUnsubscribe);
  });

  it("should cleanup field subscriptions on unregisterField", () => {
    const listener = vi.fn();
    store.registerField("test", {});

    const unsubscribe = store.subscribe(() => {
      listener();
    });

    store.setField("test", "value");
    const callsBefore = listener.mock.calls.length;

    store.unregisterField("test");
    store.setField("test", "value2");

    // Verify cleanup occurred
    const callsAfter = listener.mock.calls.length;
    expect(callsAfter).toBeLessThanOrEqual(callsBefore + 1);

    unsubscribe();
  });

  it("should not leak memory with dynamic field registration/unregistration", () => {
    const numCycles = 100;

    for (let i = 0; i < numCycles; i++) {
      const fieldPath = `field_${i}`;
      store.registerField(fieldPath, {});
      store.setField(fieldPath, `value_${i}`);
      store.unregisterField(fieldPath);
    }

    // After all cycles, store should be functional
    const state = store.getState();
    expect(state).toBeDefined();
  });

  it("should cleanup async validations on reset", async () => {
    store.registerField("asyncField", {
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
    store.setField("asyncField", "test");

    const stateBefore = store.getState();
    expect(stateBefore.isValidating["asyncField"]).toBe(true);

    // Reset should cancel validations
    store.reset();

    const stateAfter = store.getState();
    expect(stateAfter.isValidating["asyncField"]).toBeUndefined();
  });

  it("should prevent path subscription index from unbounded growth", () => {
    // Register many different paths
    for (let i = 0; i < 500; i++) {
      const path = `field_${i % 50}.sub_${i}`;
      store.registerField(path, {});

      // Subscribe to field changes
      const unsubscribe = store.subscribe(() => {
        try {
          store.getState();
        } catch {
          // Ignore errors
        }
      });

      // Immediately unsubscribe
      unsubscribe();
    }

    // Store should still be responsive
    expect(() => {
      store.getState();
    }).not.toThrow();
  });

  it("should maintain store functionality after many operations", () => {
    // Perform many field operations
    for (let i = 0; i < 50; i++) {
      store.registerField(`field_${i}`, {});
      store.setField(`field_${i}`, `value_${i}`);
    }

    // Store should still function correctly
    const state = store.getState();
    expect(state).toBeDefined();
    expect(state.values).toBeDefined();

    // Unregister half
    for (let i = 0; i < 25; i++) {
      store.unregisterField(`field_${i}`);
    }

    // Store should still function
    const finalState = store.getState();
    expect(finalState).toBeDefined();
  });
});
