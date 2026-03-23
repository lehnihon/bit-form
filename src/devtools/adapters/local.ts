import { bitBus } from "../../core";
import type { BitStoreHooksApi } from "../../core";
import type { BitBus } from "../../core";
import { BitFormDevToolsUI } from "../ui";
import { createDevToolsSnapshotMap } from "../store-snapshot";

export function setupLocalDevTools(
  container: HTMLElement,
  bus: BitBus = bitBus,
) {
  const ui = new BitFormDevToolsUI(container, {
    onUndo: (id) => (bus.stores[id] as BitStoreHooksApi<object>)?.undo(),
    onRedo: (id) => (bus.stores[id] as BitStoreHooksApi<object>)?.redo(),
    onReset: (id) => (bus.stores[id] as BitStoreHooksApi<object>)?.reset(),
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
