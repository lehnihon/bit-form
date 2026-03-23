import type { BitHistoryMetadata, BitState } from "../core";

export interface BitDevToolsReadableStore<T extends object = object> {
  getState: () => Readonly<BitState<T>>;
  getHistoryMetadata: () => BitHistoryMetadata;
}

export interface BitDevToolsActionableStore<
  T extends object = object,
> extends BitDevToolsReadableStore<T> {
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

export function isDevToolsReadableStore(
  value: unknown,
): value is BitDevToolsReadableStore<object> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as unknown as Record<string, unknown>;

  return (
    typeof candidate.getState === "function" &&
    typeof candidate.getHistoryMetadata === "function"
  );
}

export function isDevToolsActionableStore(
  value: unknown,
): value is BitDevToolsActionableStore<object> {
  if (!isDevToolsReadableStore(value)) {
    return false;
  }

  const candidate = value as unknown as Record<string, unknown>;

  return (
    typeof candidate.undo === "function" &&
    typeof candidate.redo === "function" &&
    typeof candidate.reset === "function"
  );
}

export function getDevToolsActionableStore(
  stores: Record<string, unknown>,
  storeId: string,
): BitDevToolsActionableStore<object> | null {
  const store = stores[storeId];
  return isDevToolsActionableStore(store) ? store : null;
}
