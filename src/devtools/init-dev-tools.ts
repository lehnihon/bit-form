import { setupLocalDevTools } from "./adapters/local";
import { setupRemoteDevTools } from "./adapters/remote";

export interface BitDevToolsOptions {
  container?: HTMLElement | string;
  mode?: "local" | "remote";
  socket?: any;
}

export function initDevTools(options: BitDevToolsOptions = {}) {
  const { mode = "local", socket } = options;
  let containerEl: HTMLElement;

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
  }

  if (mode === "local") {
    console.log("[bit-form] DevTools iniciado em modo Local.");
    return setupLocalDevTools(containerEl);
  }

  if (mode === "remote") {
    if (!socket) {
      throw new Error(
        "[bit-form] Você precisa passar a instância do 'socket' para usar o modo remote.",
      );
    }
    console.log("[bit-form] DevTools iniciado em modo Remote.");
    return setupRemoteDevTools(containerEl, socket);
  }

  throw new Error(`[bit-form] Modo DevTools inválido: ${mode}`);
}
