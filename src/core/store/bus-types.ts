export type BitBusListener = (storeId: string, newState: any) => void;

export interface BitFormGlobal {
  stores: Record<string, any>;
  listeners: Set<BitBusListener>;
  dispatch: (storeId: string, state: any) => void;
  subscribe: (fn: BitBusListener) => () => void;
}
