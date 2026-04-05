import { describe, expect, it, vi } from "vitest";
import { BitValidationManager } from "../../core/store/managers/features/validation-manager";

describe("BitValidationManager", () => {
  it("should accumulate scopeFields during debounce window", async () => {
    vi.useFakeTimers();

    const manager = new BitValidationManager<any>({
      getState: () => ({
        values: {},
        errors: {},
        touched: {},
        isValidating: {},
        persist: { isSaving: false, isRestoring: false, error: null },
        isValid: true,
        isSubmitting: false,
        isDirty: false,
      }),
      dispatch: () => {},
      setError: () => {},
      getFieldConfig: () => undefined,
      getScopeFields: () => [],
      forEachFieldConfig: () => {},
      config: { validationDelay: 20 } as any,
      getRequiredErrors: () => ({}),
      getHiddenFields: () => new Set<string>(),
      emitBeforeValidate: async () => {},
      emitAfterValidate: async () => {},
    });

    const validateSpy = vi.spyOn(manager, "validate").mockResolvedValue(true);

    manager.trigger(["email"]);
    await vi.advanceTimersByTimeAsync(10);
    manager.trigger(["name"]);

    await vi.advanceTimersByTimeAsync(25);

    expect(validateSpy).toHaveBeenCalledTimes(1);
    const scopeFields = validateSpy.mock.calls[0]?.[0]?.scopeFields ?? [];
    expect(scopeFields).toEqual(expect.arrayContaining(["email", "name"]));

    vi.useRealTimers();
  });

  it("should cancel pending trigger and timers on cancelAll", async () => {
    vi.useFakeTimers();

    const manager = new BitValidationManager<any>({
      getState: () => ({
        values: { username: "a" },
        errors: {},
        touched: {},
        isValidating: {},
        persist: { isSaving: false, isRestoring: false, error: null },
        isValid: true,
        isSubmitting: false,
        isDirty: false,
      }),
      dispatch: () => {},
      setError: () => {},
      getFieldConfig: () => ({
        validation: {
          asyncValidateDelay: 100,
          asyncValidate: async () => null,
        },
      }),
      getScopeFields: () => [],
      forEachFieldConfig: () => {},
      config: { validationDelay: 20 } as any,
      getRequiredErrors: () => ({}),
      getHiddenFields: () => new Set<string>(),
      emitBeforeValidate: async () => {},
      emitAfterValidate: async () => {},
    });

    manager.trigger(["username"]);
    manager.handleAsync("username", "a");
    manager.cancelAll();

    const validateSpy = vi.spyOn(manager, "validate");
    await vi.advanceTimersByTimeAsync(150);

    expect(validateSpy).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("should commit validation in a single dispatch per validate cycle", async () => {
    const dispatch = vi.fn();

    const manager = new BitValidationManager<any>({
      getState: () => ({
        values: { email: "" },
        errors: {},
        touched: {},
        isValidating: {},
        persist: { isSaving: false, isRestoring: false, error: null },
        isValid: true,
        isSubmitting: false,
        isDirty: false,
      }),
      dispatch,
      setError: () => {},
      getFieldConfig: () => undefined,
      getScopeFields: () => [],
      forEachFieldConfig: () => {},
      config: {
        validationDelay: 0,
        resolver: async () => ({ email: "required" }),
      } as any,
      getRequiredErrors: () => ({}),
      getHiddenFields: () => new Set<string>(),
      emitBeforeValidate: async () => {},
      emitAfterValidate: async () => {},
    });

    await manager.validate();

    const validationCommits = dispatch.mock.calls.filter(
      (call) => call[0]?.kind === "validation.commit",
    );

    expect(validationCommits).toHaveLength(1);
  });

  it("should prioritize scopeFields over scope when both are provided", async () => {
    const resolver = vi.fn().mockResolvedValue({});
    const onUnhandledError = vi.fn();

    const manager = new BitValidationManager<any>({
      getState: () => ({
        values: { direct: "value", scopedField: "value" },
        errors: {},
        touched: {},
        isValidating: {},
        persist: { isSaving: false, isRestoring: false, error: null },
        isValid: true,
        isSubmitting: false,
        isDirty: false,
      }),
      dispatch: () => {},
      setError: () => {},
      getFieldConfig: () => undefined,
      getScopeFields: () => ["scopedField"],
      forEachFieldConfig: () => {},
      config: {
        validationDelay: 0,
        resolver,
        onUnhandledError,
      } as any,
      getRequiredErrors: () => ({}),
      getHiddenFields: () => new Set<string>(),
      emitBeforeValidate: async () => {},
      emitAfterValidate: async () => {},
    });

    await manager.validate({
      scope: "step-1",
      scopeFields: ["direct"],
    } as any);

    expect(resolver).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ scopeFields: ["direct"] }),
    );
    expect(onUnhandledError).toHaveBeenCalledTimes(1);
  });

  it("should clear external error state before awaiting scoped revalidation", async () => {
    const setError = vi.fn();

    const manager = new BitValidationManager<any>({
      getState: () => ({
        values: { email: "a@b.com" },
        errors: { email: "invalid" },
        touched: {},
        isValidating: {},
        persist: { isSaving: false, isRestoring: false, error: null },
        isValid: false,
        isSubmitting: false,
        isDirty: false,
      }),
      dispatch: () => {},
      setError,
      getFieldConfig: () => undefined,
      getScopeFields: () => [],
      forEachFieldConfig: () => {},
      config: { validationDelay: 0 } as any,
      getRequiredErrors: () => ({}),
      getHiddenFields: () => new Set<string>(),
      emitBeforeValidate: async () => {},
      emitAfterValidate: async () => {},
    });

    let resolveValidation: ((value: boolean) => void) | undefined;
    const validateSpy = vi.spyOn(manager, "validate").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveValidation = resolve;
        }),
    );

    const pending = manager.setExternalError("email", undefined);

    expect(setError).toHaveBeenCalledWith("email", undefined);
    expect(validateSpy).toHaveBeenCalledWith({ scopeFields: ["email"] });

    resolveValidation?.(true);
    await pending;
  });

  it("should report async validation rejections and continue processing later jobs", async () => {
    vi.useFakeTimers();

    const onUnhandledError = vi.fn();
    const state = {
      values: { username: "", email: "" },
      errors: {},
      touched: {},
      isValidating: {},
      persist: { isSaving: false, isRestoring: false, error: null },
      isValid: true,
      isSubmitting: false,
      isDirty: false,
    } as any;
    const setError = vi.fn();
    const dispatch = vi.fn((operation: any) => {
      if (
        operation.kind === "state.patch" &&
        operation.partialState.isValidating
      ) {
        state.isValidating = operation.partialState.isValidating;
      }
    });
    const validators = {
      username: vi.fn(async () => {
        throw new Error("validation backend down");
      }),
      email: vi.fn(async () => "email inválido"),
    } as const;

    const manager = new BitValidationManager<any>({
      getState: () => state,
      dispatch,
      setError,
      getFieldConfig: (path) => ({
        validation: {
          asyncValidateOn: "change",
          asyncValidateDelay: 0,
          asyncValidate: validators[path as keyof typeof validators],
        },
      }),
      getScopeFields: () => [],
      forEachFieldConfig: () => {},
      config: { validationDelay: 0, onUnhandledError } as any,
      getRequiredErrors: () => ({}),
      getHiddenFields: () => new Set<string>(),
      emitBeforeValidate: async () => {},
      emitAfterValidate: async () => {},
    });

    manager.handleAsync("username", "leo");
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    expect(onUnhandledError).toHaveBeenCalledTimes(1);
    expect(onUnhandledError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "validation backend down" }),
      "validation",
    );
    expect(state.isValidating.username).toBeUndefined();

    manager.handleAsync("email", "leo@example.com");
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    expect(validators.email).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith("email", "email inválido");
    expect(state.isValidating.email).toBeUndefined();

    vi.useRealTimers();
  });
});
