import { describe, expect, it } from "vitest";
import { BitStore } from "../../core/store/bit-store-class";
import {
  createStoreBatchState,
  flushStoreBatchState,
} from "../../core/store/engines/store-batch-engine";

describe("Production Audit 11 - Core Stability", () => {
  describe("Unhandled Observability Exceptions", () => {
    it("should fallback to raw values and update state when onUnhandledError throws during derivation failure", () => {
      let threwObservabilityError = false;

      const store = new BitStore({
        initialValues: { name: "test", surname: "" },
      });

      // Bypass config normalizer to directly inject an unsafe unhandled error reporter
      // simulating a deeper failure that isn't caught by the framework's boundary
      (store as any)._config.onUnhandledError = () => {
        threwObservabilityError = true;
        throw new Error("Observability failed");
      };

      store.feature.registerField("fullName", {
        computed: () => {
          throw new Error("Computed failed");
        },
        computedDependsOn: ["surname"],
      });

      // trigger a state update
      store.write.setField("surname", "doe");

      expect(threwObservabilityError).toBe(true);

      // the operation shouldn't drop; the state should be updated with the raw value
      expect(store.read.getState().values.surname).toBe("doe");
    });
  });

  describe("Batch History Snapshot Loss", () => {
    it("should not clear pendingHistorySnapshot when flushStoreBatchState returns early", () => {
      const batchState = createStoreBatchState<any>();
      batchState.depth = 0;
      batchState.pendingState = null;
      // Simulate that something set the flag (e.g. a snapshot request inside a batch that did no state changes)
      batchState.pendingHistorySnapshot = true;

      const result = flushStoreBatchState({
        currentState: { values: {}, errors: {}, isValid: true } as any,
        batchState,
        applyValueDerivations: (v) => v,
      });

      expect(result).toBeNull();
      // The bug caused pendingHistorySnapshot to be erronously reset to false here.
      expect(batchState.pendingHistorySnapshot).toBe(true);
    });
  });
});
