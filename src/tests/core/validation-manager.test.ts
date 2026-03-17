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
      internalUpdateState: () => {},
      setError: () => {},
      validate: async () => true,
      getFieldConfig: () => undefined,
      getScopeFields: () => [],
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
      internalUpdateState: () => {},
      setError: () => {},
      validate: async () => true,
      getFieldConfig: () => ({
        validation: {
          asyncValidateDelay: 100,
          asyncValidate: async () => null,
        },
      }),
      getScopeFields: () => [],
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
});
