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

    const dispatch = vi.fn((operation: any) => {
      Object.assign(state, operation.partialState);
    });

    const manager = new BitLifecycleManager<any>({
      fieldUpdate: {
        getState: () => state,
        dispatch,
        config: { initialValues: { name: "A" }, resolver: undefined } as any,
        getFieldConfig: () => undefined,
        hasDependentFields: () => false,
        updateDependencies: () => ({
          affectedFields: [],
          visibilityChanged: [],
          requiredChanged: [],
        }),
        isFieldHidden: () => false,
        clearFieldValidation: () => {},
        triggerValidation: () => {},
        handleFieldAsyncValidation: () => {},
        updateDirtyForPath: () => false,
        getBaselineValues: () => ({ name: "A" }),
        emitFieldChange: () => {},
      },
      values: {
        getState: () => state,
        dispatch,
        internalSaveSnapshot: () => {},
        evaluateAllDependencies: () => {},
        cancelAllValidations: () => {},
        validateNow: async () => true,
        rebuildDirtyState: () => false,
        clearDirtyState: () => {},
        getBaselineValues: () => ({ name: "A" }),
        setBaselineValues: () => {},
        resetHistory: () => {},
        emitFieldChange: () => {},
        triggerValidation: () => {},
      },
      submit: {
        getState: () => state,
        dispatch,
        batchStateUpdates: (cb) => cb(),
        config: { initialValues: { name: "A" }, resolver: undefined } as any,
        getTransformEntries: () => [],
        getHiddenFields: () => new Set<string>(),
        cancelAllValidations: () => {},
        validateNow: async () => true,
        hasValidationsInProgress: () => false,
        buildDirtyValues: () => ({}),
        setServerErrors: () => {},
        emitBeforeSubmit: async () => {},
        emitAfterSubmit: async () => {},
        emitOperationalError: async () => {},
      },
    });

    manager.updateField("name", "B");

    const committed = dispatch.mock.calls.find(
      (call) => call[0]?.partialState && "errors" in call[0].partialState,
    )?.[0]?.partialState;

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

    const dispatch = (operation: any) => {
      Object.assign(state, operation.partialState);
    };

    const manager = new BitLifecycleManager<any>({
      fieldUpdate: {
        getState: () => state,
        dispatch,
        config: {
          initialValues: { hidden: "secret", amount: 10 },
          resolver: undefined,
        } as any,
        getFieldConfig: () => undefined,
        hasDependentFields: () => false,
        updateDependencies: () => ({
          affectedFields: [],
          visibilityChanged: [],
          requiredChanged: [],
        }),
        isFieldHidden: () => false,
        clearFieldValidation: () => {},
        triggerValidation: () => {},
        handleFieldAsyncValidation: () => {},
        updateDirtyForPath: () => true,
        getBaselineValues: () => ({ hidden: "secret", amount: 10 }),
        emitFieldChange: () => {},
      },
      values: {
        getState: () => state,
        dispatch,
        internalSaveSnapshot: () => {},
        evaluateAllDependencies: () => {},
        cancelAllValidations: () => {},
        validateNow: async () => true,
        rebuildDirtyState: () => true,
        clearDirtyState: () => {},
        getBaselineValues: () => ({ hidden: "secret", amount: 10 }),
        setBaselineValues: () => {},
        resetHistory: () => {},
        emitFieldChange: () => {},
        triggerValidation: () => {},
      },
      submit: {
        getState: () => state,
        dispatch,
        batchStateUpdates: (cb) => cb(),
        config: {
          initialValues: { hidden: "secret", amount: 10 },
          resolver: undefined,
        } as any,
        getTransformEntries: () => [["amount", (val: number) => val * 2]],
        getHiddenFields: () => new Set<string>(["hidden"]),
        cancelAllValidations: () => {},
        validateNow: async () => true,
        hasValidationsInProgress: () => false,
        buildDirtyValues: (values: any) => values,
        setServerErrors: () => {},
        emitBeforeSubmit: async () => {},
        emitAfterSubmit: async () => {},
        emitOperationalError: async () => {},
      },
    });

    await manager.submit(onSuccess);

    expect(onSuccess).toHaveBeenCalledTimes(1);
    const submittedValues = onSuccess.mock.calls[0][0];

    expect(submittedValues.hidden).toBeUndefined();
    expect(submittedValues.amount).toBe(20);
  });

  it("should treat validation-shaped submit errors as invalid and set server errors", async () => {
    const state: any = {
      values: { email: "demo@bit.dev" },
      errors: {},
      touched: {},
      isValidating: {},
      persist: { isSaving: false, isRestoring: false, error: null },
      isValid: true,
      isSubmitting: false,
      isDirty: false,
    };

    const dispatch = vi.fn((operation: any) => {
      Object.assign(state, operation.partialState);
    });

    const setServerErrors = vi.fn();

    const manager = new BitLifecycleManager<any>({
      fieldUpdate: {
        getState: () => state,
        dispatch,
        config: { initialValues: { email: "demo@bit.dev" } } as any,
        getFieldConfig: () => undefined,
        hasDependentFields: () => false,
        updateDependencies: () => ({
          affectedFields: [],
          visibilityChanged: [],
          requiredChanged: [],
        }),
        isFieldHidden: () => false,
        clearFieldValidation: () => {},
        triggerValidation: () => {},
        handleFieldAsyncValidation: () => {},
        updateDirtyForPath: () => false,
        getBaselineValues: () => ({ email: "demo@bit.dev" }),
        emitFieldChange: () => {},
      },
      values: {
        getState: () => state,
        dispatch,
        internalSaveSnapshot: () => {},
        evaluateAllDependencies: () => {},
        cancelAllValidations: () => {},
        validateNow: async () => true,
        rebuildDirtyState: () => false,
        clearDirtyState: () => {},
        getBaselineValues: () => ({ email: "demo@bit.dev" }),
        setBaselineValues: () => {},
        resetHistory: () => {},
        emitFieldChange: () => {},
        triggerValidation: () => {},
      },
      submit: {
        getState: () => state,
        dispatch,
        batchStateUpdates: (cb) => cb(),
        config: { initialValues: { email: "demo@bit.dev" } } as any,
        getTransformEntries: () => [],
        getHiddenFields: () => new Set<string>(),
        cancelAllValidations: () => {},
        validateNow: async () => true,
        hasValidationsInProgress: () => false,
        buildDirtyValues: () => ({}),
        setServerErrors,
        emitBeforeSubmit: async () => {},
        emitAfterSubmit: async () => {},
        emitOperationalError: async () => {},
      },
    });

    const result = await manager.submit(async () => {
      throw { errors: { email: ["Already taken"] } };
    });

    expect(result.status).toBe("invalid");
    expect(setServerErrors).toHaveBeenCalledWith({ email: ["Already taken"] });
  });

  it("should block submit when state is already submitting", async () => {
    const state: any = {
      values: { email: "demo@bit.dev" },
      errors: {},
      touched: {},
      isValidating: {},
      persist: { isSaving: false, isRestoring: false, error: null },
      isValid: true,
      isSubmitting: true,
      isDirty: false,
    };

    const dispatch = vi.fn((operation: any) => {
      Object.assign(state, operation.partialState);
    });

    const manager = new BitLifecycleManager<any>({
      fieldUpdate: {
        getState: () => state,
        dispatch,
        config: { initialValues: { email: "demo@bit.dev" } } as any,
        getFieldConfig: () => undefined,
        hasDependentFields: () => false,
        updateDependencies: () => ({
          affectedFields: [],
          visibilityChanged: [],
          requiredChanged: [],
        }),
        isFieldHidden: () => false,
        clearFieldValidation: () => {},
        triggerValidation: () => {},
        handleFieldAsyncValidation: () => {},
        updateDirtyForPath: () => false,
        getBaselineValues: () => ({ email: "demo@bit.dev" }),
        emitFieldChange: () => {},
      },
      values: {
        getState: () => state,
        dispatch,
        internalSaveSnapshot: () => {},
        evaluateAllDependencies: () => {},
        cancelAllValidations: () => {},
        validateNow: async () => true,
        rebuildDirtyState: () => false,
        clearDirtyState: () => {},
        getBaselineValues: () => ({ email: "demo@bit.dev" }),
        setBaselineValues: () => {},
        resetHistory: () => {},
        emitFieldChange: () => {},
        triggerValidation: () => {},
      },
      submit: {
        getState: () => state,
        dispatch,
        batchStateUpdates: (cb) => cb(),
        config: { initialValues: { email: "demo@bit.dev" } } as any,
        getTransformEntries: () => [],
        getHiddenFields: () => new Set<string>(),
        cancelAllValidations: () => {},
        validateNow: async () => true,
        hasValidationsInProgress: () => false,
        buildDirtyValues: () => ({}),
        setServerErrors: () => {},
        emitBeforeSubmit: async () => {},
        emitAfterSubmit: async () => {},
        emitOperationalError: async () => {},
      },
    });

    const result = await manager.submit(async () => undefined);

    expect(result).toEqual({ status: "blocked", reason: "isSubmitting" });
  });

  it("should cancel validations before applying history snapshot", () => {
    const state: any = {
      values: { name: "current" },
      errors: {},
      touched: {},
      isValidating: { name: true },
      persist: { isSaving: false, isRestoring: false, error: null },
      isValid: true,
      isSubmitting: false,
      isDirty: true,
    };

    const dispatch = vi.fn((operation: any) => {
      Object.assign(state, operation.partialState);
    });
    const cancelAllValidations = vi.fn();
    const validateNow = vi.fn(async () => true);

    const manager = new BitLifecycleManager<any>({
      fieldUpdate: {
        getState: () => state,
        dispatch,
        config: { initialValues: { name: "initial" } } as any,
        getFieldConfig: () => undefined,
        hasDependentFields: () => false,
        updateDependencies: () => ({
          affectedFields: [],
          visibilityChanged: [],
          requiredChanged: [],
        }),
        isFieldHidden: () => false,
        clearFieldValidation: () => {},
        triggerValidation: () => {},
        handleFieldAsyncValidation: () => {},
        updateDirtyForPath: () => false,
        getBaselineValues: () => ({ name: "initial" }),
        emitFieldChange: () => {},
      },
      values: {
        getState: () => state,
        dispatch,
        internalSaveSnapshot: () => {},
        evaluateAllDependencies: () => {},
        cancelAllValidations,
        validateNow,
        rebuildDirtyState: () => true,
        clearDirtyState: () => {},
        getBaselineValues: () => ({ name: "initial" }),
        setBaselineValues: () => {},
        resetHistory: () => {},
        emitFieldChange: () => {},
        triggerValidation: () => {},
      },
      submit: {
        getState: () => state,
        dispatch,
        batchStateUpdates: (cb) => cb(),
        config: { initialValues: { name: "initial" } } as any,
        getTransformEntries: () => [],
        getHiddenFields: () => new Set<string>(),
        cancelAllValidations: () => {},
        validateNow: async () => true,
        hasValidationsInProgress: () => false,
        buildDirtyValues: () => ({}),
        setServerErrors: () => {},
        emitBeforeSubmit: async () => {},
        emitAfterSubmit: async () => {},
        emitOperationalError: async () => {},
      },
    });

    manager.applyHistoryState({ name: "restored" });

    expect(cancelAllValidations).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(validateNow).toHaveBeenCalledTimes(1);

    const cancelCall = cancelAllValidations.mock.invocationCallOrder[0];
    const dispatchCall = dispatch.mock.invocationCallOrder[0];
    expect(cancelCall).toBeLessThan(dispatchCall);
  });

  it("should keep submit lock when setValues runs during in-flight submit", async () => {
    const state: any = {
      values: { email: "demo@bit.dev" },
      errors: {},
      touched: {},
      isValidating: {},
      persist: { isSaving: false, isRestoring: false, error: null },
      isValid: true,
      isSubmitting: false,
      isDirty: false,
    };

    const dispatch = vi.fn((operation: any) => {
      Object.assign(state, operation.partialState);
    });

    let releaseBeforeSubmit: (() => void) | undefined;
    let markBeforeSubmitStarted: (() => void) | undefined;
    const beforeSubmitStarted = new Promise<void>((resolve) => {
      markBeforeSubmitStarted = resolve;
    });
    const emitBeforeSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          markBeforeSubmitStarted?.();
          releaseBeforeSubmit = resolve;
        }),
    );

    const onSuccess = vi.fn(async () => undefined);

    const manager = new BitLifecycleManager<any>({
      fieldUpdate: {
        getState: () => state,
        dispatch,
        config: { initialValues: { email: "demo@bit.dev" } } as any,
        getFieldConfig: () => undefined,
        hasDependentFields: () => false,
        updateDependencies: () => ({
          affectedFields: [],
          visibilityChanged: [],
          requiredChanged: [],
        }),
        isFieldHidden: () => false,
        clearFieldValidation: () => {},
        triggerValidation: () => {},
        handleFieldAsyncValidation: () => {},
        updateDirtyForPath: () => false,
        getBaselineValues: () => ({ email: "demo@bit.dev" }),
        emitFieldChange: () => {},
      },
      values: {
        getState: () => state,
        dispatch,
        internalSaveSnapshot: () => {},
        evaluateAllDependencies: () => {},
        cancelAllValidations: () => {},
        validateNow: async () => true,
        rebuildDirtyState: () => true,
        clearDirtyState: () => {},
        getBaselineValues: () => ({ email: "demo@bit.dev" }),
        setBaselineValues: () => {},
        resetHistory: () => {},
        emitFieldChange: () => {},
        triggerValidation: () => {},
      },
      submit: {
        getState: () => state,
        dispatch,
        batchStateUpdates: (cb) => cb(),
        config: { initialValues: { email: "demo@bit.dev" } } as any,
        getTransformEntries: () => [],
        getHiddenFields: () => new Set<string>(),
        cancelAllValidations: () => {},
        validateNow: async () => true,
        hasValidationsInProgress: () => false,
        buildDirtyValues: () => ({}),
        setServerErrors: () => {},
        emitBeforeSubmit,
        emitAfterSubmit: async () => {},
        emitOperationalError: async () => {},
      },
    });

    const firstSubmitPromise = manager.submit(onSuccess);
    await beforeSubmitStarted;

    manager.setValues({ email: "updated@bit.dev" });

    const secondSubmitResult = await manager.submit(onSuccess);
    expect(secondSubmitResult).toEqual({
      status: "blocked",
      reason: "isSubmitting",
    });

    releaseBeforeSubmit?.();
    const firstSubmitResult = await firstSubmitPromise;

    expect(firstSubmitResult).toEqual({ status: "submitted" });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(state.isSubmitting).toBe(false);
  });
});
