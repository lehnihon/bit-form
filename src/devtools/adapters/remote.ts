import { BitFormDevToolsUI } from "../ui";
import type { BitBus } from "../../core";
import type {
  DevToolsActionMessage,
  DevToolsActionName,
  DevToolsRemoteMessage,
} from "../types";
import { isDevToolsStateUpdateMessage } from "../protocol";

export function setupRemoteDevTools(
  container: HTMLElement,
  url: string = "ws://localhost:3000",
  _bus?: BitBus,
) {
  const socket = new WebSocket(url);

  const sendMessage = (message: DevToolsRemoteMessage) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      console.warn(
        "[bit-form] Tentativa de envio falhou. WebSocket não está aberto.",
      );
    }
  };

  const sendAction = (storeId: string, action: DevToolsActionName) => {
    const message: DevToolsActionMessage = {
      type: "ACTION",
      payload: { storeId, action },
    };
    sendMessage(message);
  };

  const ui = new BitFormDevToolsUI(container, {
    onUndo: (id) => sendAction(id, "undo"),
    onRedo: (id) => sendAction(id, "redo"),
    onReset: (id) => sendAction(id, "reset"),
  });

  socket.addEventListener("open", () => {
    console.log(`[bit-form] Conectado ao DevTools remoto em ${url}`);
  });

  socket.addEventListener("message", (msg: MessageEvent) => {
    try {
      const data = JSON.parse(msg.data) as DevToolsRemoteMessage;
      if (isDevToolsStateUpdateMessage(data)) {
        ui.updateState(data.payload);
      }
    } catch (e) {
      console.error("[bit-form] Erro ao processar mensagem do WebSocket:", e);
    }
  });

  socket.addEventListener("error", (err) => {
    console.error("[bit-form] Erro na conexão do DevTools remoto:", err);
  });

  return {
    ui,
    destroy: () => {
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }
      container.innerHTML = "";
    },
  };
}
