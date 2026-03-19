import { bitBus } from "../../core";
import type { BitStoreHooksApi } from "../../core";
import type { BitFormGlobal } from "../../core/store/contracts/bus-types";
import { BitFormDevToolsUI } from "../ui";

export function setupLocalDevTools(
  container: HTMLElement,
  bus: BitFormGlobal = bitBus,
) {
  const ui = new BitFormDevToolsUI(container, {
    onUndo: (id) => (bus.stores[id] as BitStoreHooksApi<any>)?.undo(),
    onRedo: (id) => (bus.stores[id] as BitStoreHooksApi<any>)?.redo(),
    onReset: (id) => (bus.stores[id] as BitStoreHooksApi<any>)?.reset(),
  });

  const getFullSnapshot = () => {
    const states: Record<string, unknown> = {};

    for (const [id, instance] of Object.entries(bus.stores)) {
      const storeInstance = instance as BitStoreHooksApi<any>;
      const state = storeInstance.getState();

      const historyMeta = storeInstance?.getHistoryMetadata?.() || {
        enabled: false,
        canUndo: false,
        canRedo: false,
        historyIndex: -1,
        historySize: 0,
      };

      states[id] = {
        ...state,
        _meta: {
          canUndo: historyMeta.canUndo,
          canRedo: historyMeta.canRedo,
          totalSteps: historyMeta.historySize,
          currentIndex: historyMeta.historyIndex,
        },
      };
    }
    return states;
  };

  ui.updateState(getFullSnapshot());

  const unsubscribe = bus.subscribe(() => {
    ui.updateState(getFullSnapshot());
  });

  return {
    ui,
    destroy: () => {
      unsubscribe();
      container.innerHTML = "";
    },
  };
}
