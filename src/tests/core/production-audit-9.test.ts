import { describe, expect, it, vi } from "vitest";
import { createBitStore as createBitStoreRuntime } from "../../core";
import { BitAsyncValidationScheduler } from "../../core/store/managers/features/validation/async-validation-scheduler";

function createBitStore<T extends object = Record<string, unknown>>(
  config?: any,
) {
  return createBitStoreRuntime<T>(config) as any;
}

// ──────────────────────────────────────────────────────────────────────────────
// FINDING-1: isValidating stuck true after cancelAll() while job is in-flight
// File: async-validation-scheduler.ts
// ──────────────────────────────────────────────────────────────────────────────
describe("Production Audit 9 - Regression Tests", () => {
  describe("FINDING-1: isValidating stuck true after cancelAll() mid-flight", () => {
    it("should reset isValidating=false for in-flight jobs when cancelAll() is called", async () => {
      /**
       * SCENARIO:
       * 1. An asyncValidate job is dispatched and begins executing (in-flight).
       * 2. cancelAll() is called (e.g., user submits form or resets).
       * 3. Before fix: runJob finally block skips setFieldValidating(false) because
       *    signal.aborted === true. isValidating stays permanently stuck at true.
       * 4. After fix: cancelAll() calls setFieldValidating(false) for every active path.
       */
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

      // Schedule a validation job that hangs (won't resolve until we call resolveValidation)
      const hangingValidate = vi.fn(
        () =>
          new Promise<null>((resolve) => {
            resolveValidation = () => resolve(null);
          }),
      );

      // Trigger handle() → sets isValidating=true + schedules job
      scheduler.handle("email", "test@test.com", hangingValidate as any, 0);

      // Wait for the job to start executing (enters runJob but awaits the promise)
      await new Promise((r) => setTimeout(r, 10));

      // At this point isValidating=true was set; the job is mid-flight
      const setTrueCalls = fieldValidatingCalls.filter(
        ([, v]) => v === true,
      );
      expect(setTrueCalls.length).toBeGreaterThanOrEqual(1);

      // Clear tracking so we can observe only cancelAll's effects
      fieldValidatingCalls.length = 0;

      // cancelAll() is called mid-flight (e.g., user submits)
      scheduler.cancelAll();

      // After fix: cancelAll must have called setFieldValidating('email', false)
      const resetCalls = fieldValidatingCalls.filter(
        ([path, v]) => path === "email" && v === false,
      );
      expect(resetCalls.length).toBeGreaterThanOrEqual(1);

      // Clean up: allow the hanging promise to resolve (to avoid unhandled rejections)
      resolveValidation?.();
    });

    it("should reset isValidating=false for pending (not yet started) jobs on cancelAll()", async () => {
      /**
       * Jobs in pendingJobs also had setFieldValidating(true) called in handle().
       * cancelAll() must reset them even though they never entered runJob.
       */
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

      // Large delay so job never starts
      const neverStarted = vi.fn().mockResolvedValue(null);
      scheduler.handle("name", "leo", neverStarted as any, 99999);

      // Clear tracking
      fieldValidatingCalls.length = 0;

      scheduler.cancelAll();

      const resetCalls = fieldValidatingCalls.filter(
        ([path, v]) => path === "name" && v === false,
      );
      expect(resetCalls.length).toBeGreaterThanOrEqual(1);

      // Job should never have run
      expect(neverStarted).not.toHaveBeenCalled();
    });

    it("should emit isValidating=false via store after reset() clears in-flight async validations", async () => {
      /**
       * Integration test: store.write.reset() calls cancelAllValidations,
       * which should result in isValidating being cleared for all active fields.
       */
      let resolveEmail: (() => void) | undefined;

      const store = createBitStore({
        initialValues: { email: "" },
        fields: {
          email: {
            validation: {
              asyncValidateOn: "change",
              asyncValidateDelay: 0,
              asyncValidate: () =>
                new Promise<null>((resolve) => {
                  resolveEmail = () => resolve(null);
                }),
            },
          },
        },
      });

      store.feature.registerField("email", {
        validation: {
          asyncValidateOn: "change",
          asyncValidateDelay: 0,
          asyncValidate: () =>
            new Promise<null>((resolve) => {
              resolveEmail = () => resolve(null);
            }),
        },
      });

      // Trigger async validation
      store.write.setField("email", "test@test.com");

      // Wait for the job to start executing
      await new Promise((r) => setTimeout(r, 10));

      // isValidating should be true
      expect(store.read.getState().isValidating.email).toBe(true);

      // reset() should cancel all validations and clear isValidating
      store.write.reset();

      // After fix: isValidating.email must be false (not stuck)
      expect(store.read.getState().isValidating.email).toBeUndefined();

      // Clean up
      resolveEmail?.();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // FINDING-2: asyncErrors shared Map permanently mutated on hidden field
  // Files: validation-pipeline-stages.ts, scope-validation-commit.ts
  // ──────────────────────────────────────────────────────────────────────────────
  describe("FINDING-2: asyncErrors data loss on field visibility toggle", () => {
    it("should preserve async error when field toggles hidden then visible again", async () => {
      /**
       * SCENARIO:
       * 1. Field 'email' has asyncValidate that produces an error.
       * 2. A conditional dependency causes 'email' to become hidden temporarily.
       * 3. A validation runs while 'email' is hidden — before fix, this permanently
       *    deletes the async error from the shared Map.
       * 4. 'email' becomes visible again.
       * 5. Next validation should still show the async error.
       * 6. Before fix: error was gone. After fix: error is preserved.
       */
      const store = createBitStore({
        initialValues: { showEmail: true, email: "" },
        validation: {
          delay: 0,
        },
      });

      // Register email with async validation that always returns an error
      store.feature.registerField("email", {
        conditional: {
          dependsOn: ["showEmail"],
          showIf: (values: any) => values.showEmail === true,
        },
        validation: {
          asyncValidateOn: "change",
          asyncValidateDelay: 0,
          asyncValidate: async () => "email is invalid",
        },
      });

      // Trigger async validation for email
      store.write.setField("email", "bad@");
      await new Promise((r) => setTimeout(r, 50));

      // Confirm the async error is present
      expect(store.read.getState().errors.email).toBe("email is invalid");

      // Hide email by toggling showEmail
      store.write.setField("showEmail", false);
      await new Promise((r) => setTimeout(r, 50));

      // While hidden, email error should not appear
      expect(store.read.getState().errors.email).toBeUndefined();

      // Show email again
      store.write.setField("showEmail", true);

      // Run explicit validation
      await store.feature.validate();

      // After fix: the async error for email should still be present.
      // Before fix: asyncErrors.delete('email') had permanently cleared it.
      expect(store.read.getState().errors.email).toBe("email is invalid");
    });

    it("should not commit async errors for currently hidden fields", async () => {
      /**
       * REGRESSION CHECK: even though we no longer delete from asyncErrors,
       * hidden fields must NOT appear in committedErrors. The hiddenFields
       * filter at commit time must exclude them.
       */
      const store = createBitStore({
        initialValues: { showEmail: true, email: "" },
        validation: { delay: 0 },
      });

      store.feature.registerField("email", {
        conditional: {
          dependsOn: ["showEmail"],
          showIf: (values: any) => values.showEmail === true,
        },
        validation: {
          asyncValidateOn: "change",
          asyncValidateDelay: 0,
          asyncValidate: async () => "email is invalid",
        },
      });

      // Trigger async validation
      store.write.setField("email", "bad@");
      await new Promise((r) => setTimeout(r, 50));

      // Hide email
      store.write.setField("showEmail", false);
      await store.feature.validate();

      // Hidden field must NOT appear in errors
      expect(store.read.getState().errors.email).toBeUndefined();
      // isValid should be true since only hidden field had an error
      expect(store.read.getState().isValid).toBe(true);
    });
  });
});
