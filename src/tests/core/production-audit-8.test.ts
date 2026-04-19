import { describe, expect, it, vi } from "vitest";
import { createBitStore as createBitStoreRuntime } from "../../core";
import { BitSubscriptionEngine } from "../../core/store/engines/subscription-engine";

function createBitStore<T extends object = Record<string, unknown>>(
  config?: any,
) {
  return createBitStoreRuntime<T>(config) as any;
}

interface TestForm {
  name: string;
  email: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// FINDING-1: Optimistic isValid=true in reset()
// ──────────────────────────────────────────────────────────────────────────────
describe("Production Audit 8 - Regression Tests", () => {
  describe("FINDING-1: Optimistic isValid=true during reset()", () => {
    it("should not expose isValid=true during reset with a failing validator", async () => {
      /**
       * SCENARIO: store has a resolver that always returns an error.
       * When reset() is called:
       *   1. The synchronous dispatch must emit isValid=false (not true).
       *   2. After validate() settles, isValid is still false.
       *
       * Before the patch, the synchronous dispatch sent isValid=true,
       * momentarily exposing an incorrect value to subscribers.
       */
      const isValidEvents: boolean[] = [];

      const store = createBitStore<TestForm>({
        initialValues: {
          name: "Test",
          email: "test@test.com",
        },
        validation: {
          resolver: () => ({ email: "always invalid" }),
          delay: 0,
        },
      });

      // Capture every isValid state change
      const unsub = store.observe.subscribeFormMeta((meta: any) => {
        isValidEvents.push(meta.isValid);
      });

      // Run initial validation to set isValid=false before reset
      await store.feature.validate();
      expect(store.read.getState().isValid).toBe(false);

      // Clear captured events — we only want to inspect reset()'s emissions
      isValidEvents.length = 0;

      // --- The patch under test ---
      store.write.reset();

      // The synchronous dispatch that reset() fires must not emit isValid=true.
      // Before the patch, isValid=true was dispatched synchronously
      // then immediately overridden by validateNow(), but the subscriber
      // had already seen it and triggered a re-render.
      const hasOptimisticTrue = isValidEvents.includes(true);
      expect(hasOptimisticTrue).toBe(false);

      // Run explicit validation to settle async state
      await store.feature.validate();

      // Still false because the resolver always fails
      expect(store.read.getState().isValid).toBe(false);

      unsub();
    });

    it("should settle to isValid=true after reset when there is no validator", async () => {
      /**
       * REGRESSION CHECK: without a resolver, reset() must eventually yield
       * isValid=true after the implicit validation resolves.
       * With the patch, the initial dispatch sends false, but the subsequent
       * validate() (fired inside reset) must set it back to true.
       */
      const store = createBitStore<TestForm>({
        initialValues: {
          name: "Test",
          email: "test@test.com",
        },
        validation: { delay: 0 },
        // No resolver → empty errors → isValid=true
      });

      // Dirty the form
      store.write.setField("name", "Changed");

      store.write.reset();

      // Allow the implicit validateNow() inside reset to settle
      await store.feature.validate();

      expect(store.read.getState().isValid).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // FINDING-2: seenVersion deduplication collision when notifyVersion wraps to 0
  // ──────────────────────────────────────────────────────────────────────────────
  describe("FINDING-2: seenVersion deduplication on notifyVersion wrap to 0", () => {
    it("should notify fresh subscribers even when notifyVersion wraps back to 0", () => {
      /**
       * SCENARIO:
       * 1. Force notifyVersion to -1 (one increment away from wrapping to 0).
       * 2. Register a NEW subscriber (seenVersion not set in map → defaults).
       * 3. Trigger one notification that wraps notifyVersion to 0.
       * 4. Before fix: seenVersion defaults to 0 === currentVersion 0 → subscriber SKIPPED.
       * 5. After fix: seenVersion defaults to NaN, NaN !== 0 → subscriber CALLED.
       */
      let currentState = { values: { name: "initial" } } as any;

      const engine = new BitSubscriptionEngine<any>(() => currentState);

      // Force notifyVersion to -1: next wrap brings it to 0
      (engine as any).notifyVersion = -1;

      const listener = vi.fn();

      // Subscribe AFTER forcing notifyVersion so seenVersion is not in the map
      engine.subscribeSelector(
        (state: any) => state.values.name,
        listener,
        { paths: ["name"], emitImmediately: false },
        (prev: string, next: string) => prev === next,
      );

      // This notification wraps notifyVersion from -1 to 0
      currentState = { values: { name: "update1" } };
      engine.notify(currentState, ["name"]);

      // After fix: listener must have been called once
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith("update1");
    });

    it("should deduplicate correctly across multiple paths when notifyVersion is 0", () => {
      /**
       * REGRESSION CHECK: deduplication of the same subscriber across multiple
       * changed paths must still work after the NaN fix. The subscriber should
       * be called exactly once per notification cycle even when multiple
       * changed paths map to it.
       */
      let currentState = { values: { name: "initial", email: "a@b.com" } } as any;

      const engine = new BitSubscriptionEngine<any>(() => currentState);

      // Put notifyVersion one step before wrapping to 0
      (engine as any).notifyVersion = -1;

      const listener = vi.fn();

      // Subscribe to BOTH name and email
      engine.subscribeSelector(
        (state: any) => state.values,
        listener,
        { paths: ["name", "email"], emitImmediately: false },
        (prev: any, next: any) => prev === next,
      );

      // Notify both paths changed at once — subscriber should fire exactly once
      currentState = { values: { name: "changed", email: "x@y.com" } };
      engine.notify(currentState, ["name", "email"]);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should continue deduplication normally on subsequent notifications after wrap", () => {
      /**
       * After the wrap-to-0 notification, subsequent notifications must still
       * correctly deduplicate within the same cycle.
       */
      let currentState = { values: { name: "initial" } } as any;

      const engine = new BitSubscriptionEngine<any>(() => currentState);

      // Force wrap scenario: notifyVersion will pass through 0
      (engine as any).notifyVersion = -1;

      const listener = vi.fn();
      engine.subscribeSelector(
        (state: any) => state.values.name,
        listener,
        { paths: ["name"], emitImmediately: false },
        (prev: string, next: string) => prev === next,
      );

      // Notification at 0
      currentState = { values: { name: "update-at-zero" } };
      engine.notify(currentState, ["name"]);
      expect(listener).toHaveBeenCalledTimes(1);

      // Notification at 1 — state did not change, equality returns true → skip
      engine.notify(currentState, ["name"]);
      expect(listener).toHaveBeenCalledTimes(1);

      // Notification at 2 — state changed
      currentState = { values: { name: "update-at-two" } };
      engine.notify(currentState, ["name"]);
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });
});
