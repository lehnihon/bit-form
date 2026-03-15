import { BitBusListener, BitFormGlobal } from "../contracts/bus-types";

declare global {
  var __BIT_FORM__: BitFormGlobal | undefined;
}

const rootGlobal =
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof global !== "undefined"
      ? global
      : window;

if (!rootGlobal.__BIT_FORM__) {
  rootGlobal.__BIT_FORM__ = {
    stores: {},
    listeners: new Set<BitBusListener>(),

    dispatch(id: string, state: any) {
      this.listeners.forEach((fn: BitBusListener) => fn(id, state));
    },

    subscribe(fn: BitBusListener) {
      this.listeners.add(fn);
      return () => {
        this.listeners.delete(fn);
      };
    },
  };
}

export const bitBus = rootGlobal.__BIT_FORM__ as BitFormGlobal;
