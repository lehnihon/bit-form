import { BitFormDevToolsUI } from "../ui";

export function setupRemoteDevTools(container: HTMLElement, socket: any) {
  const ui = new BitFormDevToolsUI(container, {
    onUndo: (id) => sendMessage("ACTION", { storeId: id, action: "undo" }),
    onRedo: (id) => sendMessage("ACTION", { storeId: id, action: "redo" }),
    onReset: (id) => sendMessage("ACTION", { storeId: id, action: "reset" }),
  });

  const sendMessage = (type: string, payload: any) => {
    if (typeof socket.emit === "function") {
      socket.emit(type, payload);
    } else if (typeof socket.send === "function") {
      socket.send(JSON.stringify({ type, payload }));
    }
  };

  if (typeof socket.on === "function") {
    socket.on("STATE_UPDATE", (remoteStoresState: Record<string, any>) => {
      ui.updateState(remoteStoresState);
    });
  } else if (typeof socket.addEventListener === "function") {
    socket.addEventListener("message", (msg: any) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === "STATE_UPDATE") {
          ui.updateState(data.payload);
        }
      } catch (e) {}
    });
  }

  return ui;
}
