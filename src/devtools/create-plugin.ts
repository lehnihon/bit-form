import type { BitPlugin, DevToolsOptions } from "../core";
import { setupRemoteBridge } from "./bridge";
import { initDevTools } from "./init-dev-tools";

function resolveDevToolsOptions(
  devTools: boolean | DevToolsOptions | undefined,
): Required<Pick<DevToolsOptions, "enabled" | "mode">> &
  Pick<DevToolsOptions, "url"> {
  if (typeof devTools === "boolean") {
    return { enabled: devTools, mode: "local" };
  }

  return {
    enabled: !!devTools,
    mode: devTools?.mode ?? "local",
    url: devTools?.url,
  };
}

export function createDevToolsPlugin<T extends object = any>(
  override?: boolean | DevToolsOptions,
): BitPlugin<T> {
  return {
    name: "bit-devtools",
    setup: (context) => {
      const options = resolveDevToolsOptions(
        override ?? context.getConfig().devTools,
      );

      if (!options.enabled) {
        return;
      }

      let cleanup: (() => void) | null = null;
      const bus = context.getConfig().bus;

      try {
        if (options.mode === "remote") {
          cleanup = setupRemoteBridge(
            options.url || "ws://localhost:3000",
            bus,
          );
        } else {
          const instance = initDevTools({ bus });
          cleanup =
            instance && typeof instance.destroy === "function"
              ? instance.destroy
              : null;
        }
      } catch {
        // fail-open: devtools não deve impactar runtime principal
      }

      return () => {
        if (cleanup) {
          cleanup();
          cleanup = null;
        }
      };
    },
  };
}
