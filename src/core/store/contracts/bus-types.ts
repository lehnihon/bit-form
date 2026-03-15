import type { BitState } from "./types";

export type BitBusListener<T extends object = any> = (
  storeId: string,
  newState: BitState<T>,
) => void;

export interface BitFormGlobal {
  stores: Record<string, unknown>;
  listeners: Set<BitBusListener>;
  dispatch: (storeId: string, state: BitState<any>) => void;
  subscribe: (fn: BitBusListener) => () => void;
}
