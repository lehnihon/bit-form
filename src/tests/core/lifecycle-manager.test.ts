import { describe, expect, it, vi } from "vitest";
import { BitLifecycleManager } from "../../core/store/managers/features/lifecycle-manager";

describe("BitLifecycleManager", () => {
  it("should keep errors reference when no error needs to be cleared", () => {
    const state: any = {
      values: { name: "A" },
      errors: {},
      touched: {},
      isValidating: {},
      persist: { isSaving: false, isRestoring: false, error: null },
      isValid: true,
      isSubmitting: false,
      isDirty: false,
    };

    const internalUpdateState = vi.fn((partial: any) => {
      Object.assign(state, partial);
    });

    const manager = new BitLifecycleManager<any>({
      getState: () => state,
      internalUpdateState,
      internalSaveSnapshot: () => {},
      batchStateUpdates: (cb) => cb(),
      config: { initialValues: { name: "A" }, resolver: undefined } as any,
      getTransformEntries: () => [],
      updateDependencies: () => [],
      isFieldHidden: () => false,
      evaluateAllDependencies: () => {},
      getHiddenFields: () => new Set<string>(),
      clearFieldValidation: () => {},
      triggerValidation: () => {},
      handleFieldAsyncValidation: () => {},
      cancelAllValidations: () => {},
      validateNow: async () => true,
      hasValidationsInProgress: () => false,
      updateDirtyForPath: () => false,
      rebuildDirtyState: () => false,
      clearDirtyState: () => {},
      buildDirtyValues: () => ({}),
      getInitialValues: () => ({ name: "A" }),
      setInitialValues: () => {},
      resetHistory: () => {},
      emitFieldChange: () => {},
      emitBeforeSubmit: async () => {},
      emitAfterSubmit: async () => {},
      emitOperationalError: async () => {},
    });

    manager.updateField("name", "B");

    const committed = internalUpdateState.mock.calls.find(
      (call) => call[0] && "errors" in call[0],
    )?.[0];

    expect(committed.errors).toBe(state.errors);
  });

  it("should apply hidden paths and transforms in submit preparation", async () => {
    const state: any = {
      values: {
        hidden: "secret",
        amount: 10,
      },
      errors: {},
      touched: {},
      isValidating: {},
      persist: { isSaving: false, isRestoring: false, error: null },
      isValid: true,
      isSubmitting: false,
      isDirty: true,
    };

    const onSuccess = vi.fn();

    const manager = new BitLifecycleManager<any>({
      getState: () => state,
      internalUpdateState: (partial: any) => {
        Object.assign(state, partial);
      },
      internalSaveSnapshot: () => {},
      batchStateUpdates: (cb) => cb(),
      config: {
        initialValues: { hidden: "secret", amount: 10 },
        resolver: undefined,
      } as any,
      getTransformEntries: () => [["amount", (val: number) => val * 2]],
      updateDependencies: () => [],
      isFieldHidden: () => false,
      evaluateAllDependencies: () => {},
      getHiddenFields: () => new Set<string>(["hidden"]),
      clearFieldValidation: () => {},
      triggerValidation: () => {},
      handleFieldAsyncValidation: () => {},
      cancelAllValidations: () => {},
      validateNow: async () => true,
      hasValidationsInProgress: () => false,
      updateDirtyForPath: () => true,
      rebuildDirtyState: () => true,
      clearDirtyState: () => {},
      buildDirtyValues: (values: any) => values,
      getInitialValues: () => ({ hidden: "secret", amount: 10 }),
      setInitialValues: () => {},
      resetHistory: () => {},
      emitFieldChange: () => {},
      emitBeforeSubmit: async () => {},
      emitAfterSubmit: async () => {},
      emitOperationalError: async () => {},
    });

    await manager.submit(onSuccess);

    expect(onSuccess).toHaveBeenCalledTimes(1);
    const submittedValues = onSuccess.mock.calls[0][0];

    expect(submittedValues.hidden).toBeUndefined();
    expect(submittedValues.amount).toBe(20);
  });
});
