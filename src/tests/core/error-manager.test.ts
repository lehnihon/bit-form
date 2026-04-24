import { describe, expect, it, vi } from "vitest";
import { BitErrorManager } from "../../core/store/managers/features/error-manager";

describe("BitErrorManager", () => {
  it("should ignore invalid setError input and report to onUnhandledError", () => {
    const state: any = {
      errors: {},
    };

    const dispatch = vi.fn((operation: any) => {
      Object.assign(state, operation.partialState);
    });

    const reportError = vi.fn();

    const manager = new BitErrorManager<any>(
      () => state,
      dispatch,
      reportError,
    );

    manager.setError("", "required");
    manager.setError("email", null as any);

    expect(dispatch).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledTimes(2);
  });

  it("should sanitize setErrors payload by ignoring invalid entries", () => {
    const state: any = {
      errors: {},
    };

    const dispatch = vi.fn((operation: any) => {
      Object.assign(state, operation.partialState);
    });

    const reportError = vi.fn();

    const manager = new BitErrorManager<any>(
      () => state,
      dispatch,
      reportError,
    );

    manager.setErrors({
      email: "required",
      "": "invalid-path",
      cpf: undefined,
      phone: 10 as any,
    });

    expect(state.errors).toEqual({
      email: "required",
      cpf: undefined,
    });
    expect(reportError).toHaveBeenCalledTimes(2);
  });

  describe("Observability Integration", () => {
    it("should safely isolate observability crashes in validation without rejecting promises", async () => {
      let loggerCalled = 0;
      const { createBitStore } = await import("../../core");

      const store = (createBitStore as any)({
        initialValues: {
          name: "Test",
          email: "test@test.com",
        },
        validation: {
          resolver: () => {
            throw new Error("Resolver Crash");
          },
        },
        onUnhandledError: () => {
          loggerCalled++;
          throw new Error("Circular JSON inside Observability Tool");
        },
      });

      const result = await store.feature.validate();

      expect(result).toBe(false);
      expect(loggerCalled).toBe(1);
    });

    it("should safely isolate observability crashes in submit without rejecting promises", async () => {
      let loggerCalled = 0;
      const { createBitStore } = await import("../../core");

      const store = (createBitStore as any)({
        initialValues: {
          name: "Test",
          email: "test@test.com",
        },
        onUnhandledError: () => {
          loggerCalled++;
          throw new Error("Sentry Crash During Submit!");
        },
      });

      const result = await store.write.submit(() => {
        throw new Error("API Fetch Error");
      });

      expect(result.status).toBe("failed");
      expect((result as any).error.message).toBe("API Fetch Error");
      expect(loggerCalled).toBe(1);
    });
  });
});
