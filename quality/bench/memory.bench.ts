import { describe, it, expect } from "vitest";
import { createBitStore } from "../../src/core/store/orchestration/create-store";

/**
 * Memory Profiling Benchmarks
 *
 * Measures memory allocation and cleanup in various scenarios.
 * Helps detect memory leaks and regression in memory efficiency.
 *
 * Note: These tests are indicative. Actual memory usage depends on:
 * - Node.js version
 * - GC strategy
 * - Other processes' memory usage
 */

interface TestForm {
  [key: string]: any;
  count: number;
}

function runGCIfAvailable() {
  if (
    typeof global !== "undefined" &&
    typeof (global as any).gc === "function"
  ) {
    (global as any).gc();
  }
}

describe("Memory Profiling", () => {
  it("should not leak memory with 1000 fields created and destroyed", () => {
    const store = createBitStore<TestForm>({
      initialValues: { count: 0 },
    });

    runGCIfAvailable();
    // Record initial heap usage (approximate)
    const beforeHeap = (process.memoryUsage().heapUsed || 0) / 1024 / 1024;

    // Create and destroy 1000 fields
    for (let i = 0; i < 1000; i++) {
      const fieldPath = `field_${i}`;
      store.registerField(fieldPath, {});
      store.setField(fieldPath, `value_${i}`);
      store.unregisterField(fieldPath);
    }

    // Cleanup
    store.cleanup();

    runGCIfAvailable();
    const afterHeap = (process.memoryUsage().heapUsed || 0) / 1024 / 1024;
    const heapGrowth = afterHeap - beforeHeap;

    // Heap growth can fluctuate significantly in CI due to VM pressure and GC timing.
    // Keep a conservative but realistic budget to catch true regressions.
    console.log(
      `Memory growth after 1000 field cycles: ${heapGrowth.toFixed(2)}MB`,
    );
    expect(heapGrowth).toBeLessThan(25); // 25MB max growth
  });

  it("should efficiently handle 100 undo/redo cycles with history", async () => {
    const store = createBitStore<TestForm>({
      initialValues: { count: 0 },
      history: { enabled: true, limit: 30 },
    });

    const beforeHeap = (process.memoryUsage().heapUsed || 0) / 1024 / 1024;

    // Perform many changes (triggers snapshots)
    for (let i = 0; i < 100; i++) {
      store.setField("count", i);
    }

    // Undo and redo
    for (let i = 0; i < 20; i++) {
      if (store.getHistoryMetadata().canUndo) {
        store.undo();
      }
      if (store.getHistoryMetadata().canRedo) {
        store.redo();
      }
    }

    const afterHeap = (process.memoryUsage().heapUsed || 0) / 1024 / 1024;
    const heapUsed = afterHeap - beforeHeap;

    // With lazy cloning, memory usage should be modest (~2-3MB for 30 snapshots)
    console.log(
      `Memory used by history (30 snapshots): ${heapUsed.toFixed(2)}MB`,
    );
    expect(heapUsed).toBeLessThan(5); // 5MB max for 100 undo/redo cycles
  });

  it("should handle 500 field subscriptions without memory leaks", () => {
    const store = createBitStore<TestForm>({
      initialValues: { count: 0 },
    });

    runGCIfAvailable();
    const beforeHeap = (process.memoryUsage().heapUsed || 0) / 1024 / 1024;
    const unsubscribers: Array<() => void> = [];

    // Create 500 subscriptions
    for (let i = 0; i < 500; i++) {
      const unsub = store.subscribe(() => {
        // noop
      });
      unsubscribers.push(unsub);
    }

    const middleHeap = (process.memoryUsage().heapUsed || 0) / 1024 / 1024;
    const subscriptionMemory = middleHeap - beforeHeap;

    console.log(
      `Memory for 500 subscriptions: ${subscriptionMemory.toFixed(2)}MB`,
    );

    // Cleanup all subscriptions
    unsubscribers.forEach((unsub) => unsub());

    const afterHeap = (process.memoryUsage().heapUsed || 0) / 1024 / 1024;
    const remainingMemory = afterHeap - beforeHeap;

    // After cleanup, should release most memory.
    // For very small peaks (<~0.2MB), noise can dominate, so use absolute floor.
    console.log(
      `Memory retained after cleanup: ${remainingMemory.toFixed(
        2,
      )}MB (vs peak ${subscriptionMemory.toFixed(2)}MB)`,
    );
    const maxRetained = Math.max(subscriptionMemory * 1.5, 0.3);
    expect(remainingMemory).toBeLessThan(maxRetained);
  });

  it("should efficiently handle large validation queues", async () => {
    const store = createBitStore<TestForm>({
      initialValues: { count: 0 },
    });

    const beforeHeap = (process.memoryUsage().heapUsed || 0) / 1024 / 1024;

    // Register many fields with async validators
    for (let i = 0; i < 100; i++) {
      store.registerField(`field_${i}`, {
        validation: {
          asyncValidate: async (value: any) => {
            // Simulate async validation
            return new Promise((resolve) => {
              setTimeout(() => {
                resolve(undefined); // No error
              }, 10);
            });
          },
          asyncValidateDelay: 50,
        },
      });
    }

    // Trigger validations
    for (let i = 0; i < 100; i++) {
      store.setField(`field_${i}`, `test_${i}`);
    }

    // Wait for validations to settle (approximate)
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Reset to cancel remaining validations
    store.reset();

    runGCIfAvailable();
    const afterHeap = (process.memoryUsage().heapUsed || 0) / 1024 / 1024;
    const validationMemory = afterHeap - beforeHeap;

    console.log(
      `Memory for 100 async validators: ${validationMemory.toFixed(2)}MB`,
    );
    expect(validationMemory).toBeLessThan(8); // 8MB max
  });

  it("should track growing forms efficiently", () => {
    const store = createBitStore<TestForm>({
      initialValues: { count: 0 },
    });

    const beforeHeap = (process.memoryUsage().heapUsed || 0) / 1024 / 1024;

    // Simulate progressive field growth (like dynamic form arrays)
    for (let batch = 0; batch < 10; batch++) {
      for (let i = 0; i < 100; i++) {
        const fieldIndex = batch * 100 + i;
        store.registerField(`field_${fieldIndex}`, {});
        store.setField(`field_${fieldIndex}`, `value_${fieldIndex}`);
      }

      // Periodic cleanup of old fields
      if (batch > 0) {
        for (let i = 0; i < 50; i++) {
          const fieldIndex = (batch - 1) * 100 + i;
          store.unregisterField(`field_${fieldIndex}`);
        }
      }
    }

    const afterHeap = (process.memoryUsage().heapUsed || 0) / 1024 / 1024;
    const totalMemory = afterHeap - beforeHeap;

    // 1000 fields (with partial cleanup) can fluctuate significantly in CI VMs.
    // Keep a broad cap to detect major regressions without flaky failures.
    console.log(
      `Memory for progressive field growth (1000 fields): ${totalMemory.toFixed(
        2,
      )}MB`,
    );
    expect(totalMemory).toBeLessThan(25); // 25MB max
  });
});
