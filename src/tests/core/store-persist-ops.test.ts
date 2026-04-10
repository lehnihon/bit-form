import { describe, expect, it, vi } from "vitest";
import {
  applyStorePersistedValues,
  clearStorePersisted,
  forceStorePersistedSave,
} from "../../core/store/orchestration/store-persist-ops";

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
});

describe("forceStorePersistedSave", () => {
  it("should always reset isSaving in a final dispatch on success", async () => {
    const dispatch = vi.fn();
    const effects = {
      savePersistedNow: vi.fn(async () => undefined),
    } as any;

    await forceStorePersistedSave({ dispatch, effects });

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      kind: "form.persistMeta",
      patch: { isSaving: true, error: null },
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      kind: "form.persistMeta",
      patch: { isSaving: false, error: null },
    });
  });

  it("should reset isSaving and expose error when save fails", async () => {
    const dispatch = vi.fn();
    const effects = {
      savePersistedNow: vi.fn(async () => {
        throw new Error("save failed");
      }),
    } as any;

    await forceStorePersistedSave({ dispatch, effects });

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      kind: "form.persistMeta",
      patch: { isSaving: true, error: null },
    });
    expect(dispatch.mock.calls[1]?.[0]?.kind).toBe("form.persistMeta");
    expect(dispatch.mock.calls[1]?.[0]?.patch?.isSaving).toBe(false);
    expect(dispatch.mock.calls[1]?.[0]?.patch?.error).toBeInstanceOf(Error);
    expect(dispatch.mock.calls[1]?.[0]?.patch?.error?.message).toBe(
      "save failed",
    );
  });
});

describe("clearStorePersisted", () => {
  it("should finalize metadata with error null when clear succeeds", async () => {
    const dispatch = vi.fn();
    const effects = {
      clearPersisted: vi.fn(async () => undefined),
    } as any;

    await clearStorePersisted({ dispatch, effects });

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      kind: "form.persistMeta",
      patch: { isSaving: true, error: null },
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      kind: "form.persistMeta",
      patch: { isSaving: false, error: null },
    });
  });

  it("should finalize metadata with error when clear fails", async () => {
    const dispatch = vi.fn();
    const effects = {
      clearPersisted: vi.fn(async () => {
        throw new Error("clear failed");
      }),
    } as any;

    await clearStorePersisted({ dispatch, effects });

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      kind: "form.persistMeta",
      patch: { isSaving: true, error: null },
    });
    expect(dispatch.mock.calls[1]?.[0]?.kind).toBe("form.persistMeta");
    expect(dispatch.mock.calls[1]?.[0]?.patch?.isSaving).toBe(false);
    expect(dispatch.mock.calls[1]?.[0]?.patch?.error).toBeInstanceOf(Error);
    expect(dispatch.mock.calls[1]?.[0]?.patch?.error?.message).toBe(
      "clear failed",
    );
  });
});
