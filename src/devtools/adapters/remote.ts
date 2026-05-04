import { BitFormDevToolsUI } from "../ui";
import type { BitBus } from "../../core";
import type {
  DevToolsHelloMessage,
  DevToolsActionMessage,
  DevToolsActionName,
  DevToolsRemoteMessage,
} from "../types";
import {
  DEVTOOLS_PROTOCOL_VERSION,
  isDevToolsStateUpdateMessage,
} from "../protocol";

export function setupRemoteDevTools(
  container: HTMLElement,
  url: string = "ws://localhost:3000",
  _bus?: BitBus,
) {
  let socket: WebSocket;

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
      protocolVersion: DEVTOOLS_PROTOCOL_VERSION,
      payload: { storeId, action },
    };
    sendMessage(message);
  };

  const ui = new BitFormDevToolsUI(container, {
    onUndo: (id) => sendAction(id, "undo"),
    onRedo: (id) => sendAction(id, "redo"),
    onReset: (id) => sendAction(id, "reset"),
  });

  let destroyed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  function attachListeners() {
    socket.addEventListener("open", () => {
      const helloMessage: DevToolsHelloMessage = {
        type: "HELLO",
        protocolVersion: DEVTOOLS_PROTOCOL_VERSION,
        payload: { role: "client", protocolVersion: DEVTOOLS_PROTOCOL_VERSION },
      };

      sendMessage(helloMessage);
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

    socket.addEventListener("close", () => {
      if (destroyed) return;
      console.log("[bit-form] Conexão DevTools remota fechada. Reconectando em 5s...");
      reconnectTimer = setTimeout(() => {
        if (destroyed) return;
        connect();
      }, 5000);
    });
  }

  function connect() {
    socket = new WebSocket(url);
    attachListeners();
  }

  connect();

  return {
    ui,
    destroy: () => {
      destroyed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
      }
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
