import { describe, expect, it, vi } from "vitest";
import { createBitBus } from "../../core/store/shared/bus";

describe("Bus - Shared Event Pipeline", () => {
  describe("Listener Error Chain Resilience", () => {
    it("should continue notifying listeners even if one listener throws", () => {
      const bus = createBitBus();

      const listener1 = vi.fn(() => {
        throw new Error("Listener 1 intentional error");
      });
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      bus.subscribe(listener1);
      bus.subscribe(listener2);
      bus.subscribe(listener3);

      const testState = {
        values: {},
        errors: {},
        touched: {},
        isValidating: {},
        isValid: false,
        isDirty: false,
        persist: { isSaving: false, isRestoring: false, error: null },
      } as any;
      bus.dispatch("store-1", testState);

      expect(listener1).toHaveBeenCalledWith("store-1", testState);
      expect(listener2).toHaveBeenCalledWith("store-1", testState);
      expect(listener3).toHaveBeenCalledWith("store-1", testState);
    });

    it("should continue notifying listeners if multiple listeners throw", () => {
      const bus = createBitBus();

      const listener1 = vi.fn(() => {
        throw new Error("Error 1");
      });
      const listener2 = vi.fn(() => {
        throw new Error("Error 2");
      });
      const listener3 = vi.fn();

      bus.subscribe(listener1);
      bus.subscribe(listener2);
      bus.subscribe(listener3);

      const testState = {
        values: {},
        errors: {},
        touched: {},
        isValidating: {},
        isValid: false,
        isDirty: false,
        persist: { isSaving: false, isRestoring: false, error: null },
      } as any;
      bus.dispatch("store-2", testState);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledWith("store-2", testState);
    });

    it("should handle errors in listeners without breaking subscriptions", () => {
      const bus = createBitBus();
      const successfulListener = vi.fn();

      bus.subscribe(() => {
        throw new Error("Intentional error");
      });

      bus.subscribe(successfulListener);

      const testState = {
        values: {},
        errors: {},
        touched: {},
        isValidating: {},
        isValid: false,
        isDirty: false,
        persist: { isSaving: false, isRestoring: false, error: null },
      } as any;

      bus.dispatch("store-3", testState);

      expect(successfulListener).toHaveBeenCalledTimes(1);
    });
  });
});
