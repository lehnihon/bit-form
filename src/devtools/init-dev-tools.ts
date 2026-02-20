import { setupLocalDevTools } from "./adapters/local";
import { setupRemoteDevTools } from "./adapters/remote";

export interface BitDevToolsOptions {
  container?: HTMLElement | string;
  mode?: "local" | "remote";
  url?: string;
}

export function initDevTools(options: BitDevToolsOptions = {}) {
  const { mode = "local", url } = options;
  let containerEl: HTMLElement;

  let isAutoCreated = false;

  if (typeof options.container === "string") {
    const el = document.querySelector<HTMLElement>(options.container);
    if (!el)
      throw new Error(
        `[bit-form] Container '${options.container}' não encontrado na página.`,
      );
    containerEl = el;
  } else if (options.container instanceof HTMLElement) {
    containerEl = options.container;
  } else {
    containerEl = document.createElement("div");
    containerEl.id = "bit-form-devtools-root";
    containerEl.style.position = "fixed";
    containerEl.style.bottom = "20px";
    containerEl.style.right = "20px";
    containerEl.style.zIndex = "9999";
    containerEl.style.maxHeight = "80vh";
    containerEl.style.overflowY = "auto";
    containerEl.style.boxShadow = "0 10px 25px rgba(0,0,0,0.1)";
    document.body.appendChild(containerEl);
    isAutoCreated = true;
  }

  let adapterInstance: any;

  if (mode === "local") {
    console.log("[bit-form] DevTools iniciado em modo Local.");
    adapterInstance = setupLocalDevTools(containerEl);
  } else if (mode === "remote") {
    console.log("[bit-form] DevTools iniciado em modo Remote.");
    adapterInstance = setupRemoteDevTools(containerEl, url);
  } else {
    throw new Error(`[bit-form] Modo DevTools inválido: ${mode}`);
  }

  return {
    ...adapterInstance,
    destroy: () => {
      if (adapterInstance && typeof adapterInstance.destroy === "function") {
        adapterInstance.destroy();
      }

      if (isAutoCreated && containerEl.parentNode) {
        containerEl.parentNode.removeChild(containerEl);
      } else {
        containerEl.innerHTML = "";
      }
    },
  };
}
