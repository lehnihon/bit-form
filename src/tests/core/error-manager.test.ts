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
});
