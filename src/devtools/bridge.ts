import { bitBus } from "bit-form/core";

const formatStoreState = (instance: any) => {
  const cleanState =
    typeof instance.getState === "function" ? instance.getState() : instance;

  const historyMeta = instance?.getHistoryMetadata?.() || {
    canUndo: false,
    canRedo: false,
    historyIndex: -1,
    historySize: 0,
  };

  return {
    ...cleanState,
    _meta: {
      canUndo: historyMeta.canUndo,
      canRedo: historyMeta.canRedo,
      totalSteps: historyMeta.historySize,
      currentIndex: historyMeta.historyIndex,
    },
  };
};

let activeBridgeCleanup: (() => void) | null = null;

export function setupRemoteBridge(url: string) {
  if (activeBridgeCleanup) {
    console.warn(
      "[bit-form] Reiniciando ponte do DevTools (Fast Refresh detectado).",
    );
    activeBridgeCleanup();
  }

  let socket: WebSocket | null = null;
  let unsubscribeBus: (() => void) | null = null;
  let heartbeatInterval: ReturnType<typeof setInterval>;
  let isIntentionalDisconnect = false;

  const connect = () => {
    isIntentionalDisconnect = false;
    socket = new WebSocket(url);

    socket.onopen = () => {
      console.log("[bit-form] 🔌 Conectado ao CLI DevTools via WebSocket.");

      const storesEntries = Object.entries(bitBus.stores);
      if (storesEntries.length > 0) {
        const initialState = storesEntries.reduce(
          (acc, [id, store]) => {
            acc[id] = formatStoreState(store);
            return acc;
          },
          {} as Record<string, any>,
        );

        socket?.send(
          JSON.stringify({ type: "STATE_UPDATE", payload: initialState }),
        );
      }

      unsubscribeBus = bitBus.subscribe((storeId, _newState) => {
        if (socket?.readyState === WebSocket.OPEN) {
          const storeInstance = bitBus.stores[storeId];
          if (storeInstance) {
            socket.send(
              JSON.stringify({
                type: "STATE_UPDATE",
                payload: { [storeId]: formatStoreState(storeInstance) },
              }),
            );
          }
        }
      });

      heartbeatInterval = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "PING" }));
        }
      }, 30000);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as {
          type?: unknown;
          payload?: unknown;
        };

        if (message.type === "ACTION") {
          const payload = message.payload as {
            storeId?: unknown;
            action?: unknown;
          };
          const storeId = payload.storeId;
          const action = payload.action;

          if (typeof storeId !== "string" || typeof action !== "string") {
            return;
          }

          const store = bitBus.stores[storeId];

          if (!store || typeof store !== "object") {
            return;
          }

          const method = (store as Record<string, unknown>)[action];
          if (typeof method === "function") {
            (method as () => void).call(store);
          }
        }
      } catch (e) {
        console.warn("[bit-form] Erro ao processar comando do CLI:", e);
      }
    };

    socket.onclose = () => {
      if (unsubscribeBus) unsubscribeBus();
      clearInterval(heartbeatInterval);

      if (!isIntentionalDisconnect) {
        console.log("[bit-form] Conexão perdida. Reconectando em 3s...");
        setTimeout(connect, 3000);
      } else {
        console.log("[bit-form] Ponte antiga encerrada com sucesso.");
      }
    };
  };

  connect();

  const cleanup = () => {
    isIntentionalDisconnect = true;

    if (unsubscribeBus) unsubscribeBus();
    clearInterval(heartbeatInterval);
    if (
      socket &&
      (socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING)
    ) {
      socket.close();
    }
    activeBridgeCleanup = null;
  };

  activeBridgeCleanup = cleanup;

  return cleanup;
}
