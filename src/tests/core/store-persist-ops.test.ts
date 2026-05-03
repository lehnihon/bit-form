import { describe, expect, it, vi } from "vitest";
import {
  applyStorePersistedValues,
  clearStorePersisted,
  forceStorePersistedSave,
  restoreStorePersisted,
} from "../../core/store/orchestration/store-persist-ops";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("applyStorePersistedValues", () => {
  it("should preserve isSubmitting while applying persisted values", () => {
    const state: any = {
      values: { name: "A" },
      errors: { name: "error" },
      touched: { name: true },
      isValidating: { name: true },
      persist: { isSaving: false, isRestoring: false, error: new Error("x") },
      isValid: false,
      isSubmitting: true,
      isDirty: false,
    };

    const dispatch = vi.fn((operation: any) => {
      Object.assign(state, operation.partialState);
    });

    applyStorePersistedValues({
      values: { name: "B" },
      state,
      initialValues: { name: "A" },
      validation: {
        cancelAll: vi.fn(),
        validate: vi.fn(async () => true),
      },
      fieldRegistry: {
        evaluateAll: vi.fn(),
      } as any,
      dirtyManager: {
        rebuild: vi.fn(() => true),
      } as any,
      dispatch,
      saveHistorySnapshot: vi.fn(),
    });

    expect(state.isSubmitting).toBe(true);
    const partialState = dispatch.mock.calls[0]?.[0]?.partialState ?? {};
    expect("isSubmitting" in partialState).toBe(false);
  });

  it("should avoid optimistic isValid=true before validation settles", () => {
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

    applyStorePersistedValues({
      values: { name: "B" },
      state,
      initialValues: { name: "A" },
      validation: {
        cancelAll: vi.fn(),
        validate: vi.fn(async () => false),
      },
      fieldRegistry: {
        evaluateAll: vi.fn(),
      } as any,
      dirtyManager: {
        rebuild: vi.fn(() => true),
      } as any,
      dispatch,
      saveHistorySnapshot: vi.fn(),
    });

    expect(state.isValid).toBe(false);
    expect(
      dispatch.mock.calls.some(
        (call) => call[0]?.partialState?.isValid === false,
      ),
    ).toBe(true);
  });
});

describe("forceStorePersistedSave", () => {
  it("should delegate success path without local metadata dispatch", async () => {
    const dispatch = vi.fn();
    const effects = {
      savePersistedNow: vi.fn(async () => undefined),
    } as any;

    await forceStorePersistedSave({ dispatch, effects });

    expect(dispatch).not.toHaveBeenCalled();
    expect(effects.savePersistedNow).toHaveBeenCalledTimes(1);
  });

  it("should propagate save errors to the caller and route them through onUnhandledError", async () => {
    const dispatch = vi.fn();
    const onUnhandledError = vi.fn();
    const saveError = new Error("save failed");
    const effects = {
      savePersistedNow: vi.fn(async () => {
        throw saveError;
      }),
    } as any;

    await expect(
      forceStorePersistedSave({ dispatch, effects, onUnhandledError }),
    ).rejects.toThrow("save failed");

    expect(onUnhandledError).toHaveBeenCalledWith(saveError, "persist");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("should allow concurrent saves without throwing", async () => {
    const dispatch = vi.fn();

    const first = createDeferred<void>();
    const second = createDeferred<void>();
    const effects = {
      savePersistedNow: vi
        .fn()
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => second.promise),
    } as any;

    const op1 = forceStorePersistedSave({ dispatch, effects });
    const op2 = forceStorePersistedSave({ dispatch, effects });

    first.resolve();
    await op1;

    second.resolve();
    await op2;

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("should reject when save fails and resolve independently when another save succeeds", async () => {
    const dispatch = vi.fn();
    const onUnhandledError = vi.fn();

    const first = createDeferred<void>();
    const second = createDeferred<void>();
    const effects = {
      savePersistedNow: vi
        .fn()
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => second.promise),
    } as any;

    const op1 = forceStorePersistedSave({
      dispatch,
      effects,
      onUnhandledError,
    });
    const op2 = forceStorePersistedSave({ dispatch, effects });

    first.reject(new Error("first failed"));
    await expect(op1).rejects.toThrow("first failed");
    expect(onUnhandledError).toHaveBeenCalledTimes(1);

    second.resolve();
    await op2;

    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("clearStorePersisted", () => {
  it("should delegate clear success without local metadata dispatch", async () => {
    const dispatch = vi.fn();
    const effects = {
      clearPersisted: vi.fn(async () => undefined),
    } as any;

    await clearStorePersisted({ dispatch, effects });

    expect(dispatch).not.toHaveBeenCalled();
    expect(effects.clearPersisted).toHaveBeenCalledTimes(1);
  });

  it("should propagate clear errors to the caller and route them through onUnhandledError", async () => {
    const dispatch = vi.fn();
    const onUnhandledError = vi.fn();
    const clearError = new Error("clear failed");
    const effects = {
      clearPersisted: vi.fn(async () => {
        throw clearError;
      }),
    } as any;

    await expect(
      clearStorePersisted({ dispatch, effects, onUnhandledError }),
    ).rejects.toThrow("clear failed");

    expect(onUnhandledError).toHaveBeenCalledWith(clearError, "persist");
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("restoreStorePersisted", () => {
  it("should keep isRestoring=true until all concurrent restores finish", async () => {
    const dispatch = vi.fn();

    const first = createDeferred<boolean>();
    const second = createDeferred<boolean>();
    const effects = {
      restorePersisted: vi
        .fn()
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => second.promise),
    } as any;

    const op1 = restoreStorePersisted({ dispatch, effects });
    const op2 = restoreStorePersisted({ dispatch, effects });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      kind: "form.persistMeta",
      patch: { isRestoring: true, error: null },
    });

    first.resolve(true);
    await op1;

    expect(
      dispatch.mock.calls.some((call) => call[0]?.patch?.isRestoring === false),
    ).toBe(false);

    second.resolve(true);
    await op2;

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      kind: "form.persistMeta",
      patch: { isRestoring: false, error: null },
    });
  });

  it("should not share isRestoring state between different stores (dispatch closures)", async () => {
    const dispatch1 = vi.fn();
    const dispatch2 = vi.fn();

    const def1 = createDeferred<boolean>();
    const def2 = createDeferred<boolean>();

    const effects1 = { restorePersisted: vi.fn(() => def1.promise) } as any;
    const effects2 = { restorePersisted: vi.fn(() => def2.promise) } as any;

    const op1 = restoreStorePersisted({
      dispatch: dispatch1,
      effects: effects1,
    });
    const op2 = restoreStorePersisted({
      dispatch: dispatch2,
      effects: effects2,
    });

    expect(dispatch1).toHaveBeenNthCalledWith(1, {
      kind: "form.persistMeta",
      patch: { isRestoring: true, error: null },
    });
    expect(dispatch2).toHaveBeenNthCalledWith(1, {
      kind: "form.persistMeta",
      patch: { isRestoring: true, error: null },
    });

    def1.resolve(true);
    await op1;

    expect(dispatch1).toHaveBeenNthCalledWith(2, {
      kind: "form.persistMeta",
      patch: { isRestoring: false, error: null },
    });
    // dispatch2 should NOT have received a false patch yet
    expect(dispatch2).toHaveBeenCalledTimes(1);

    def2.resolve(true);
    await op2;

    expect(dispatch2).toHaveBeenNthCalledWith(2, {
      kind: "form.persistMeta",
      patch: { isRestoring: false, error: null },
    });
  });
});
