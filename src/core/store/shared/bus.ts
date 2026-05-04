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

    dispatch(id: string, state) {
      this.listeners.forEach((fn: BitBusListener) => {
        try {
          fn(id, state);
        } catch (error) {
          if (typeof console !== "undefined" && console.warn) {
            console.warn("[bit-form] Bus listener error:", error);
          }
        }
      });
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
      listeners.forEach((fn) => {
        try {
          fn(id, state);
        } catch {
          // Silently swallow listener errors to prevent breaking the notification chain
        }
      });
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
