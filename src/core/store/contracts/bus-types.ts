import type { BitState } from "./types";

export interface BitBusStorePort<T extends object = object> {
  getState: () => Readonly<BitState<T>>;
  getHistoryMetadata: () => {
    canUndo: boolean;
    canRedo: boolean;
    historySize: number;
    historyIndex: number;
  };
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

export type BitBusListener<T extends object = object> = (
  storeId: string,
  newState: BitState<T>,
) => void;

export interface BitFormGlobal {
  stores: Record<string, BitBusStorePort<object>>;
  listeners: Set<BitBusListener>;
  dispatch: (storeId: string, state: BitState<object>) => void;
  subscribe: (fn: BitBusListener) => () => void;
}

/** Alias for {@link BitFormGlobal}. Prefer this name in user-facing APIs. */
export type BitBus = BitFormGlobal;
