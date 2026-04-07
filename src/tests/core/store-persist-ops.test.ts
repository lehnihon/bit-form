import { describe, expect, it, vi } from "vitest";
import { applyStorePersistedValues } from "../../core/store/orchestration/store-persist-ops";

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
