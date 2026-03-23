import { describe, expect, it } from "vitest";
import {
  getDevToolsActionableStore,
  isDevToolsActionableStore,
  isDevToolsReadableStore,
} from "../../devtools/store-port";

describe("devtools store-port", () => {
  const readable = {
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
    getHistoryMetadata: () => ({
      canUndo: false,
      canRedo: false,
      historySize: 0,
      historyIndex: -1,
    }),
  };

  const actionable = {
    ...readable,
    undo: () => {},
    redo: () => {},
    reset: () => {},
  };

  it("identifica store legível", () => {
    expect(isDevToolsReadableStore(readable)).toBe(true);
    expect(isDevToolsReadableStore(null)).toBe(false);
    expect(isDevToolsReadableStore({})).toBe(false);
  });

  it("identifica store acionável", () => {
    expect(isDevToolsActionableStore(actionable)).toBe(true);
    expect(isDevToolsActionableStore(readable)).toBe(false);
    expect(isDevToolsActionableStore({})).toBe(false);
  });

  it("resolve store acionável por id", () => {
    const stores = {
      a: actionable,
      b: readable,
    } as Record<string, unknown>;

    expect(getDevToolsActionableStore(stores, "a")).toBe(actionable);
    expect(getDevToolsActionableStore(stores, "b")).toBeNull();
    expect(getDevToolsActionableStore(stores, "x")).toBeNull();
  });
});
