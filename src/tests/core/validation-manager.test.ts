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
});
