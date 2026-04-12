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

  it("should swallow save errors and avoid local metadata dispatch", async () => {
    const dispatch = vi.fn();
    const effects = {
      savePersistedNow: vi.fn(async () => {
        throw new Error("save failed");
      }),
    } as any;

    await expect(
      forceStorePersistedSave({ dispatch, effects }),
    ).resolves.toBeUndefined();

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

  it("should resolve when a failed save completes before a successful one", async () => {
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

    first.reject(new Error("first failed"));
    await op1;

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

  it("should swallow clear failures and avoid local metadata dispatch", async () => {
    const dispatch = vi.fn();
    const effects = {
      clearPersisted: vi.fn(async () => {
        throw new Error("clear failed");
      }),
    } as any;

    await expect(
      clearStorePersisted({ dispatch, effects }),
    ).resolves.toBeUndefined();

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
});
