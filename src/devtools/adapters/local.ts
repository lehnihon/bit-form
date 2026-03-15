import { bitBus } from "../../core";
import type { BitStoreHooksApi } from "../../core";
import { BitFormDevToolsUI } from "../ui";

export function setupLocalDevTools(container: HTMLElement) {
  const ui = new BitFormDevToolsUI(container, {
    onUndo: (id) => (bitBus.stores[id] as BitStoreHooksApi<any>)?.undo(),
    onRedo: (id) => (bitBus.stores[id] as BitStoreHooksApi<any>)?.redo(),
    onReset: (id) => (bitBus.stores[id] as BitStoreHooksApi<any>)?.reset(),
  });

  const getFullSnapshot = () => {
    const states: Record<string, unknown> = {};

    for (const [id, instance] of Object.entries(bitBus.stores)) {
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

  const unsubscribe = bitBus.subscribe(() => {
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
