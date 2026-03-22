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

const noopBus: BitFormGlobal = {
  stores: {},
  listeners: new Set<BitBusListener>(),
  dispatch: () => {},
  subscribe: () => () => {},
};

export function getNoopBitBus(): BitFormGlobal {
  return noopBus;
}

/**
 * Creates an isolated bus instance — not connected to the browser global.
 * Use this in SSR / Edge Runtime environments (e.g. Next.js Edge) where a
 * shared `globalThis` singleton is unsafe across request contexts.
 *
 * @example
 * // _app.tsx (SSR-safe)
 * const bus = createBitBus();
 * const store = createBitStore({ bus, initialValues: { ... } });
 */
export function createBitBus(): BitFormGlobal {
  const listeners = new Set<BitBusListener>();
  return {
    stores: {},
    listeners,
    dispatch(id, state) {
      listeners.forEach((fn) => fn(id, state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
