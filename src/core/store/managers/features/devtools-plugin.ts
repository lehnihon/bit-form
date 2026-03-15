import type { BitPlugin, DevToolsOptions } from "../../contracts/types";

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

export function createDevtoolsPlugin<T extends object = any>(
  devTools: boolean | DevToolsOptions | undefined,
): BitPlugin<T> | null {
  const options = resolveDevToolsOptions(devTools);

  if (!options.enabled) {
    return null;
  }

  return {
    name: "bit-devtools",
    setup: () => {
      let cleanup: (() => void) | null = null;
      let destroyed = false;

      void (async () => {
        try {
          if (options.mode === "remote") {
            const { setupRemoteBridge } =
              await import("../../../../devtools/bridge");
            cleanup = setupRemoteBridge(options.url || "ws://localhost:3000");
          } else {
            const { initDevTools } = await import("../../../../devtools");
            const instance = initDevTools();
            cleanup =
              instance && typeof instance.destroy === "function"
                ? instance.destroy
                : null;
          }

          if (destroyed && cleanup) {
            cleanup();
            cleanup = null;
          }
        } catch {
          // fail-open: devtools não deve impactar runtime principal
        }
      })();

      return () => {
        destroyed = true;
        if (cleanup) {
          cleanup();
          cleanup = null;
        }
      };
    },
  };
}
