/**
 * Production Audit 12 — Regression Tests
 *
 * Covers two production-critical patches applied to the Core:
 *
 * FINDING-1 (CRITICAL): Silent Data Loss — pendingHistorySnapshot cleared on
 *   derivation failure in flushStoreBatchState, causing undo() to skip user
 *   mutations permanently. [store-batch-engine.ts]
 *
 * FINDING-2 (HIGH): Unhandled Exceptions — the RAW fallback in
 *   executeStatePatchOperation had no error boundary; a secondary failure
 *   in that path would throw unhandled into the framework component tree.
 *   [store-commit-engine.ts]
 */

import { describe, expect, it, vi } from "vitest";
import { BitStore } from "../../core/store/bit-store-class";
import {
  beginStoreBatch,
  createStoreBatchState,
  endStoreBatch,
  flushStoreBatchState,
  trackBatchedStoreUpdate,
} from "../../core/store/engines/store-batch-engine";
import { dispatchStoreKernelOperation } from "../../core/store/engines/store-commit-engine";
import { patchStateOperation } from "../../core/store/engines/operation-engine";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makeBaseState<T extends object>(values: T) {
  return {
    values,
    errors: {} as Record<string, string>,
    touched: {} as Record<string, boolean>,
    isValidating: {} as Record<string, boolean>,
    isSubmitting: false,
    isDirty: false,
    isValid: true,
    persist: {
      initialized: false,
      isSaving: false,
      isRestoring: false,
      error: null,
    },
  };
}

// ---------------------------------------------------------------------------
// FINDING-1: Silent Data Loss — history snapshot must survive a derivation failure
// ---------------------------------------------------------------------------

describe("Production Audit 12 — FINDING-1: Silent Data Loss in Batch History Snapshot", () => {
  /**
   * Core scenario:
   * A batch accumulates value changes. When flushStoreBatchState runs, the
   * derivation function throws. Before the patch, the engine wrongly cleared
   * pendingHistorySnapshot, so flushStoreBatchedStateUpdates would skip
   * saveHistory — the user's mutation became invisible to undo().
   */
  it("should preserve pendingHistorySnapshot when derivation throws during batch flush", () => {
    const currentState = makeBaseState({ name: "alice" });
    const batchState = createStoreBatchState<any>();

    // Simulate a value mutation enqueued inside a batch
    trackBatchedStoreUpdate(batchState, {
      nextState: { ...currentState, values: { name: "bob" } },
      valuesChanged: true,
      changedPaths: ["name"],
    });

    // pendingHistorySnapshot should already be set by trackBatchedStoreUpdate
    expect(batchState.pendingHistorySnapshot).toBe(true);

    const failingDerivation = vi.fn().mockImplementation(() => {
      throw new Error("Derivation failed");
    });
    const onDerivationError = vi.fn();

    const result = flushStoreBatchState({
      currentState,
      batchState,
      applyValueDerivations: failingDerivation,
      onDerivationError,
    });

    // The flush must still produce a result (raw values committed)
    expect(result).not.toBeNull();
    expect(result!.nextState.values.name).toBe("bob");
    expect(result!.valuesChanged).toBe(true);

    // CRITICAL: the flag must NOT have been cleared — the caller
    // (flushStoreBatchedStateUpdates) still needs to record the snapshot.
    expect(batchState.pendingHistorySnapshot).toBe(true);

    // Derivation was attempted and error was surfaced
    expect(failingDerivation).toHaveBeenCalled();
    expect(onDerivationError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("should record history via BitStore when a batch-level derivation fails", () => {
    /**
     * Integration-level proof: after two mutations inside a transaction where
     * the computed field always throws, undo() must still be able to walk back
     * to the original state because the raw snapshot was recorded.
     */
    const store = new BitStore({
      initialValues: { count: 0, computed: "" },
      history: { enabled: true, debounceMs: 0 },
    });

    store.feature.registerField("computed", {
      computed: () => {
        throw new Error("computed always fails");
      },
      computedDependsOn: ["count"],
    });

    const initialValues = store.read.getState().values;

    // Batch two mutations — derivation will fail on flush
    store.write.transaction(() => {
      store.write.setField("count", 1);
      store.write.setField("count", 2);
    });

    // Raw value committed despite derivation error
    expect(store.read.getState().values.count).toBe(2);

    // History must have recorded the snapshot — undo() must revert to 0
    store.feature.undo();
    expect(store.read.getState().values.count).toBe(initialValues.count);
  });

  it("should NOT record a history snapshot when the batch has no pending state (early-return path)", () => {
    /**
     * Regression guard: flushStoreBatchState returns null when pendingState is
     * null. It must NOT touch pendingHistorySnapshot in that path — the flag
     * may have been set externally via saveStoreHistorySnapshot and must
     * survive to be consumed by the caller.
     */
    const batchState = createStoreBatchState<any>();
    batchState.pendingState = null;
    batchState.pendingHistorySnapshot = true; // set externally

    const result = flushStoreBatchState({
      currentState: makeBaseState({}),
      batchState,
      applyValueDerivations: (v) => v,
    });

    expect(result).toBeNull();
    // Flag must be untouched — the caller is the sole owner of this reset.
    expect(batchState.pendingHistorySnapshot).toBe(true);
  });

  it("should still call onDerivationError even when the handler itself throws", () => {
    /**
     * The observability handler must be called regardless of whether it throws.
     * Its own exception must be contained so it cannot abort the batch flush.
     */
    const currentState = makeBaseState({ x: 1 });
    const batchState = createStoreBatchState<any>();

    trackBatchedStoreUpdate(batchState, {
      nextState: { ...currentState, values: { x: 2 } },
      valuesChanged: true,
      changedPaths: ["x"],
    });

    const onDerivationError = vi.fn().mockImplementation(() => {
      throw new Error("APM reporting failed");
    });

    expect(() =>
      flushStoreBatchState({
        currentState,
        batchState,
        applyValueDerivations: () => {
          throw new Error("derivation failed");
        },
        onDerivationError,
      }),
    ).not.toThrow();

    expect(onDerivationError).toHaveBeenCalledOnce();
    // And the flag is still set (not wrongly cleared)
    expect(batchState.pendingHistorySnapshot).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// FINDING-2: Unhandled Exceptions — fallback path must not propagate
// ---------------------------------------------------------------------------

describe("Production Audit 12 — FINDING-2: Unhandled Exceptions in Commit Engine Fallback", () => {
  /**
   * Core scenario:
   * dispatchStoreKernelOperation → executeStatePatchOperation catches a
   * derivation error. It then executes a RAW fallback (no derivation).
   * Before the patch, if the RAW fallback itself threw (e.g. immutable proxy,
   * serialisation error), the exception would propagate unhandled into
   * React/Vue/Angular's render cycle → white screen.
   */
  it("should not throw when both the derivation and the RAW fallback fail", () => {
    const state = makeBaseState({ a: 1 });
    const batchState = createStoreBatchState<any>();

    // patchStateOperation that will drive a values update
    const operation = {
      kind: "state.patch" as const,
      ...patchStateOperation({ values: { a: 2 } }),
    };

    // applyValueDerivations always fails — triggers the fallback path
    const applyValueDerivations = vi.fn().mockImplementation(() => {
      throw new Error("Primary derivation failed");
    });

    // Intercept applyStateUpdate by making the second (RAW) call also fail.
    // We do this by having the derivation function throw on every call.
    // The RAW path passes `(values) => values` so a throw there requires
    // the partialState to trigger a failure. We can simulate that by
    // injecting a getter trap on the partialState property.
    const poisonedOperation = {
      kind: "state.patch" as const,
      partialState: new Proxy(
        { values: { a: 2 } },
        {
          get(target, prop) {
            if (prop === "values") {
              throw new Error("Immutable proxy — cannot read values");
            }
            return Reflect.get(target, prop);
          },
        },
      ) as any,
      changedPaths: undefined,
      skipComputed: false,
    };

    const onOperationError = vi.fn();
    const onStateCommitted = vi.fn();

    // Must NOT throw — must abort gracefully and return original state
    let nextState: typeof state | undefined;
    expect(() => {
      nextState = dispatchStoreKernelOperation({
        state,
        batchState,
        operation: poisonedOperation,
        applyValueDerivations,
        onOperationError,
        onStateCommitted,
      });
    }).not.toThrow();

    // The original state is preserved (mutation aborted)
    expect(nextState).toBe(state);
    // No state committed since the fallback failed
    expect(onStateCommitted).not.toHaveBeenCalled();
  });

  it("should commit the RAW state when only the derivation fails (happy-path fallback)", () => {
    /**
     * When the primary derivation throws but the RAW fallback succeeds,
     * the operation must still commit — this is the normal recovery path.
     */
    const state = makeBaseState({ score: 10 });
    const batchState = createStoreBatchState<any>();

    const operation = {
      kind: "state.patch" as const,
      ...patchStateOperation({ values: { score: 20 } }),
    };

    const applyValueDerivations = vi.fn().mockImplementation(() => {
      throw new Error("Computed field threw");
    });
    const onOperationError = vi.fn();
    const onStateCommitted = vi.fn();

    const nextState = dispatchStoreKernelOperation({
      state,
      batchState,
      operation,
      applyValueDerivations,
      onOperationError,
      onStateCommitted,
    });

    // RAW values committed
    expect(nextState.values.score).toBe(20);
    expect(onStateCommitted).toHaveBeenCalledOnce();
    expect(onOperationError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("should contain observability errors while still committing the RAW fallback", () => {
    /**
     * onOperationError throwing must not abort the RAW fallback commit.
     */
    const state = makeBaseState({ label: "before" });
    const batchState = createStoreBatchState<any>();

    const operation = {
      kind: "state.patch" as const,
      ...patchStateOperation({ values: { label: "after" } }),
    };

    const applyValueDerivations = vi.fn().mockImplementation(() => {
      throw new Error("derivation failed");
    });
    const onOperationError = vi.fn().mockImplementation(() => {
      throw new Error("APM also failed");
    });
    const onStateCommitted = vi.fn();

    let nextState: typeof state | undefined;
    expect(() => {
      nextState = dispatchStoreKernelOperation({
        state,
        batchState,
        operation,
        applyValueDerivations,
        onOperationError,
        onStateCommitted,
      });
    }).not.toThrow();

    // RAW value must still be committed despite APM failure
    expect(nextState!.values.label).toBe("after");
    expect(onStateCommitted).toHaveBeenCalledOnce();
  });

  it("should preserve state integrity via BitStore end-to-end when computed always throws", () => {
    /**
     * End-to-end regression: a computed field that always throws must not
     * crash the store or leave it in an undefined state.
     */
    const store = new BitStore({
      initialValues: { qty: 5, total: 0 },
    });

    store.feature.registerField("total", {
      computed: () => {
        throw new Error("price lookup service unavailable");
      },
      computedDependsOn: ["qty"],
    });

    expect(() => {
      store.write.setField("qty", 10);
    }).not.toThrow();

    // Raw value committed
    expect(store.read.getState().values.qty).toBe(10);
    // Form remains usable
    expect(store.read.getState().isSubmitting).toBe(false);
  });
});
