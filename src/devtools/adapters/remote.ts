import { BitFormDevToolsUI } from "../ui";

export function setupRemoteDevTools(
  container: HTMLElement,
  url: string = "ws://localhost:3000",
) {
  const socket = new WebSocket(url);

  const ui = new BitFormDevToolsUI(container, {
    onUndo: (id) => sendMessage("ACTION", { storeId: id, action: "undo" }),
    onRedo: (id) => sendMessage("ACTION", { storeId: id, action: "redo" }),
    onReset: (id) => sendMessage("ACTION", { storeId: id, action: "reset" }),
  });

  const sendMessage = (type: string, payload: any) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type, payload }));
    } else {
      console.warn(
        "[bit-form] Tentativa de envio falhou. WebSocket não está aberto.",
      );
    }
  };

  socket.addEventListener("open", () => {
    console.log(`[bit-form] Conectado ao DevTools remoto em ${url}`);
  });

  socket.addEventListener("message", (msg: MessageEvent) => {
    try {
      const data = JSON.parse(msg.data);
      if (data.type === "STATE_UPDATE") {
        ui.updateState(data.payload);
      }
    } catch (e) {
      console.error("[bit-form] Erro ao processar mensagem do WebSocket:", e);
    }
  });

  socket.addEventListener("error", (err) => {
    console.error("[bit-form] Erro na conexão do DevTools remoto:", err);
  });

  return ui;
}
