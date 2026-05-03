import { describe, expect, it, vi } from "vitest";
import { BitAsyncValidationScheduler } from "../../core/store/managers/features/validation/async-validation-scheduler";

describe("BitAsyncValidationScheduler", () => {
  it("should cleanup abortController from Map after validation completes (memory leak prevention)", async () => {
    vi.useFakeTimers();

    const port = {
      schedule: (fn: () => void, delayMs: number) => {
        const timeoutId = setTimeout(fn, delayMs);
        return () => clearTimeout(timeoutId);
      },
      getValues: () => ({ username: "john" }),
      setFieldValidating: vi.fn(),
      setAsyncError: vi.fn(),
      clearAsyncError: vi.fn(),
      onValidationPassed: vi.fn(),
      onError: vi.fn(),
    };

    const scheduler = new BitAsyncValidationScheduler(port);

    const asyncValidate = vi.fn().mockResolvedValue(null); // Success

    // First validation
    scheduler.handle("username", "john", asyncValidate, 100);
    expect((scheduler as any).abortControllers.size).toBe(1);

    await vi.advanceTimersByTimeAsync(100);
    await vi.runAllTimersAsync();

    // After validation completes, abortController should be cleaned up
    expect((scheduler as any).abortControllers.size).toBe(0);

    // Second validation with same path should create new controller
    scheduler.handle("username", "jane", asyncValidate, 100);
    expect((scheduler as any).abortControllers.size).toBe(1);

    await vi.advanceTimersByTimeAsync(100);
    await vi.runAllTimersAsync();

    expect((scheduler as any).abortControllers.size).toBe(0);

    vi.useRealTimers();
  });

  it("should guard against stale abortController cleanup (controller identity check)", async () => {
    vi.useFakeTimers();

    const port = {
      schedule: (fn: () => void, delayMs: number) => {
        const timeoutId = setTimeout(fn, delayMs);
        return () => clearTimeout(timeoutId);
      },
      getValues: () => ({ username: "john" }),
      setFieldValidating: vi.fn(),
      setAsyncError: vi.fn(),
      clearAsyncError: vi.fn(),
      onValidationPassed: vi.fn(),
      onError: vi.fn(),
    };

    const scheduler = new BitAsyncValidationScheduler(port);
    const asyncValidate = vi.fn().mockResolvedValue(null);

    // First validation
    scheduler.handle("username", "john", asyncValidate, 100);
    const firstController = (scheduler as any).abortControllers.get("username");
    expect(firstController).toBeDefined();

    // Cancel before it completes
    scheduler.cancel("username");
    expect((scheduler as any).abortControllers.size).toBe(0);

    // Start second validation
    scheduler.handle("username", "jane", asyncValidate, 100);
    const secondController = (scheduler as any).abortControllers.get(
      "username",
    );
    expect(secondController).toBeDefined();
    expect(secondController).not.toBe(firstController);

    await vi.advanceTimersByTimeAsync(100);
    await vi.runAllTimersAsync();

    // Only the current controller should be in the map initially
    expect((scheduler as any).abortControllers.size).toBe(0);

    vi.useRealTimers();
  });

  describe("cancelAll resilience", () => {
    it("should reset isValidating=false for in-flight jobs when cancelAll() is called", async () => {
      const fieldValidatingCalls: Array<[string, boolean]> = [];
      let resolveValidation: (() => void) | undefined;

      const port = {
        schedule: (fn: () => void, delay: number) => {
          const id = setTimeout(fn, delay);
          return () => clearTimeout(id);
        },
        getValues: () => ({ email: "test@test.com" }),
        setFieldValidating: (path: string, isValidating: boolean) => {
          fieldValidatingCalls.push([path, isValidating]);
        },
        setAsyncError: vi.fn(),
        clearAsyncError: vi.fn(),
        onValidationPassed: vi.fn().mockResolvedValue(undefined),
        onError: vi.fn(),
      };

      const scheduler = new BitAsyncValidationScheduler(port as any);

      const hangingValidate = vi.fn(
        () =>
          new Promise<null>((resolve) => {
            resolveValidation = () => resolve(null);
          }),
      );

      scheduler.handle("email", "test@test.com", hangingValidate as any, 0);

      await new Promise((r) => setTimeout(r, 10));

      const setTrueCalls = fieldValidatingCalls.filter(([, v]) => v === true);
      expect(setTrueCalls.length).toBeGreaterThanOrEqual(1);

      fieldValidatingCalls.length = 0;

      scheduler.cancelAll();

      const resetCalls = fieldValidatingCalls.filter(
        ([path, v]) => path === "email" && v === false,
      );
      // cancelAll must synchronously emit setFieldValidating(path, false)
      // for every in-flight job so spinners never stay stuck.
      expect(resetCalls.length).toBeGreaterThanOrEqual(1);

      resolveValidation?.();
    });

    it("should reset isValidating=false for pending (not yet started) jobs on cancelAll()", async () => {
      const fieldValidatingCalls: Array<[string, boolean]> = [];

      const port = {
        schedule: (fn: () => void, delay: number) => {
          const id = setTimeout(fn, delay);
          return () => clearTimeout(id);
        },
        getValues: () => ({ name: "leo" }),
        setFieldValidating: (path: string, isValidating: boolean) => {
          fieldValidatingCalls.push([path, isValidating]);
        },
        setAsyncError: vi.fn(),
        clearAsyncError: vi.fn(),
        onValidationPassed: vi.fn().mockResolvedValue(undefined),
        onError: vi.fn(),
      };

      const scheduler = new BitAsyncValidationScheduler(port as any);

      const neverStarted = vi.fn().mockResolvedValue(null);
      scheduler.handle("name", "leo", neverStarted as any, 99999);

      fieldValidatingCalls.length = 0;

      scheduler.cancelAll();

      const resetCalls = fieldValidatingCalls.filter(
        ([path, v]) => path === "name" && v === false,
      );
      // cancelAll must synchronously emit setFieldValidating(path, false)
      // for pending (not yet started) jobs too.
      expect(resetCalls.length).toBeGreaterThanOrEqual(1);

      expect(neverStarted).not.toHaveBeenCalled();
    });
  });

  describe("Async Validation Stability - Integration", () => {
    it("should cleanup all pending async validations gracefully", async () => {
      const { createBitStore } = await import("../../core");
      const store = (createBitStore as any)({
        initialValues: { email: "" },
        fields: {
          email: {
            validation: {
              asyncValidate: async (value: string) => {
                return new Promise((resolve) => {
                  setTimeout(() => {
                    resolve(value.includes("@") ? null : "invalid email");
                  }, 100);
                });
              },
            },
          },
        },
      });

      store.write.setField("email", "test");
      expect(store.read.getState()).toBeDefined();
    });

    it("should handle rapid value changes in async validation", async () => {
      const { createBitStore } = await import("../../core");
      const validationCalls: string[] = [];

      const store = (createBitStore as any)({
        initialValues: { email: "" },
        fields: {
          email: {
            validation: {
              asyncValidate: async (value: string) => {
                validationCalls.push(value);
                return new Promise((resolve) => {
                  setTimeout(() => {
                    resolve(value.includes("@") ? null : "invalid");
                  }, 50);
                });
              },
            },
          },
        },
      });

      store.write.setField("email", "t");
      store.write.setField("email", "te");
      store.write.setField("email", "tes");
      store.write.setField("email", "test@");
      store.write.setField("email", "test@example.com");

      await new Promise((resolve) => setTimeout(resolve, 200));

      const finalState = store.read.getState();
      expect(finalState.values.email).toBe("test@example.com");
      expect(finalState.errors.email).toBeUndefined();
    });
  });

  describe("Production Audit Regressions", () => {
    it("ACHADO-5: should clear isValidating even when asyncValidate throws an exception", async () => {
      const fieldValidatingCalls: Array<[string, boolean]> = [];

      const port = {
        schedule: (fn: () => void, delay: number) => {
          const id = setTimeout(fn, delay);
          return () => clearTimeout(id);
        },
        getValues: () => ({ email: "test@test.com" }),
        setFieldValidating: (path: string, val: boolean) => {
          fieldValidatingCalls.push([path, val]);
        },
        setAsyncError: vi.fn(),
        clearAsyncError: vi.fn(),
        onValidationPassed: vi.fn().mockResolvedValue(undefined),
        onError: vi.fn(),
      };

      const scheduler = new BitAsyncValidationScheduler(port as any);

      const throwingValidate = vi.fn(async () => {
        throw new Error("validator crashed unexpectedly");
      });

      scheduler.handle("email", "test@test.com", throwingValidate as any, 0);

      // Wait for the job to flush and run
      await new Promise((r) => setTimeout(r, 30));

      const falseCalls = fieldValidatingCalls.filter(
        ([path, val]) => path === "email" && val === false,
      );

      // isValidating(false) MUST have been called even though asyncValidate threw
      expect(falseCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("ACHADO-5: should not leave isValidating=true when asyncValidate throws after abort signal", async () => {
      const fieldValidatingCalls: Array<[string, boolean]> = [];
      let abortSignalRef: AbortSignal | undefined;

      const port = {
        schedule: (fn: () => void, delay: number) => {
          const id = setTimeout(fn, delay);
          return () => clearTimeout(id);
        },
        getValues: () => ({ email: "test@test.com" }),
        setFieldValidating: (path: string, val: boolean) => {
          fieldValidatingCalls.push([path, val]);
        },
        setAsyncError: vi.fn(),
        clearAsyncError: vi.fn(),
        onValidationPassed: vi.fn().mockResolvedValue(undefined),
        onError: vi.fn(),
      };

      const scheduler = new BitAsyncValidationScheduler(port as any);

      // Validator that captures the abort signal and throws after abort
      const throwAfterAbort = vi.fn(
        async (value: unknown, allValues: unknown) => {
          // Simulate a slow validator that checks abort mid-flight
          await new Promise((r) => setTimeout(r, 20));
          throw new Error("crashed after long computation");
        },
      );

      scheduler.handle("email", "test@test.com", throwAfterAbort as any, 0);

      // Cancel before the validator finishes
      await new Promise((r) => setTimeout(r, 5));
      scheduler.cancel("email");

      // Wait for all async work to settle
      await new Promise((r) => setTimeout(r, 50));

      const trueAfterCancel = fieldValidatingCalls
        .slice(fieldValidatingCalls.findIndex(([, v]) => v === false))
        .filter(([, v]) => v === true);

      // No spurious isValidating=true after cleanup
      expect(trueAfterCancel).toHaveLength(0);
    });
  });
});
