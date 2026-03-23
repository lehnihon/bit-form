import { bitBus } from "../../core";
import type { BitBus } from "../../core";
import { BitFormDevToolsUI } from "../ui";
import { createDevToolsSnapshotMap } from "../store-snapshot";
import { getDevToolsActionableStore } from "../store-port";

export function setupLocalDevTools(
  container: HTMLElement,
  bus: BitBus = bitBus,
) {
  const ui = new BitFormDevToolsUI(container, {
    onUndo: (id) => getDevToolsActionableStore(bus.stores, id)?.undo(),
    onRedo: (id) => getDevToolsActionableStore(bus.stores, id)?.redo(),
    onReset: (id) => getDevToolsActionableStore(bus.stores, id)?.reset(),
  });

  const getFullSnapshot = () => createDevToolsSnapshotMap(bus.stores);

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
