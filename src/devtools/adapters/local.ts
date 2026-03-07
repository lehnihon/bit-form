import { bitBus } from "../../core";
import type { BitStore } from "../../core/store";
import { BitFormDevToolsUI } from "../ui";

export function setupLocalDevTools(container: HTMLElement) {
  const ui = new BitFormDevToolsUI(container, {
    onUndo: (id) => (bitBus.stores[id] as BitStore<any>)?.undo(),
    onRedo: (id) => (bitBus.stores[id] as BitStore<any>)?.redo(),
    onReset: (id) => (bitBus.stores[id] as BitStore<any>)?.reset(),
  });

  const getFullSnapshot = () => {
    const states: Record<string, any> = {};

    for (const [id, instance] of Object.entries(bitBus.stores)) {
      const storeInstance = instance as any;
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
