import { BitStore } from "./index";
import type { DevToolsOptions } from "./types";
import { setupRemoteBridge } from "../../devtools/bridge";
import { initDevTools } from "../../devtools";

export class BitDevtoolsManager<T extends object> {
  private store: BitStore<T>;
  private cleanupFn: (() => void) | null = null;

  constructor(store: BitStore<T>) {
    this.store = store;
    this.setup();
  }

  private setup() {
    const devTools = this.store.config.devTools;
    if (!devTools) return;

    const options: Required<Pick<DevToolsOptions, "enabled" | "mode">> &
      Pick<DevToolsOptions, "url"> =
      typeof devTools === "boolean"
        ? { enabled: devTools, mode: "local" }
        : { enabled: true, mode: devTools.mode ?? "local", ...devTools };

    if (!options.enabled) return;

    if (options.mode === "remote") {
      const url = options.url || "ws://localhost:3000";
      this.cleanupFn = setupRemoteBridge(url);
    } else {
      const instance = initDevTools();

      if (instance && typeof instance.destroy === "function") {
        this.cleanupFn = instance.destroy;
      }
    }
  }

  public destroy() {
    if (this.cleanupFn) {
      this.cleanupFn();
    }
  }
}
