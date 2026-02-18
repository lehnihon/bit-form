import { bitBus, BitStore } from "../../core";
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

      const historyManager = storeInstance?.history;
      const historyArray = historyManager?.history || [];
      const currentIndex = historyManager?.historyIndex ?? -1;

      states[id] = {
        ...state,
        _meta: {
          canUndo: storeInstance?.canUndo,
          canRedo: storeInstance?.canRedo,
          totalSteps: historyArray.length,
          currentIndex: currentIndex,
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
