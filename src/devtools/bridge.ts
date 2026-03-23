import { bitBus } from "../core";
import type { BitBus } from "../core";
import { DEVTOOLS_PROTOCOL_VERSION, isDevToolsActionMessage } from "./protocol";
import { createDevToolsSnapshotMap } from "./store-snapshot";
import { getDevToolsActionableStore } from "./store-port";

let activeBridgeCleanup: (() => void) | null = null;
const STATE_BATCH_INTERVAL_MS = 50;

export function setupRemoteBridge(url: string, bus: BitBus = bitBus) {
  if (activeBridgeCleanup) {
    console.warn(
      "[bit-form] Reiniciando ponte do DevTools (Fast Refresh detectado).",
    );
    activeBridgeCleanup();
  }

  let socket: WebSocket | null = null;
  let unsubscribeBus: (() => void) | null = null;
  let heartbeatInterval: ReturnType<typeof setInterval>;
  let batchFlushTimeout: ReturnType<typeof setTimeout> | null = null;
  const pendingStoreIds = new Set<string>();
  let isIntentionalDisconnect = false;

  const sendWhenOpen = (message: Record<string, unknown>) => {
    if (socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify(message));
  };

  const flushPendingStoreUpdates = () => {
    if (pendingStoreIds.size === 0) {
      return;
    }

    const payload = createDevToolsSnapshotMap(
      Array.from(pendingStoreIds).reduce<Record<string, unknown>>(
        (acc, storeId) => {
          const storeInstance = bus.stores[storeId];
          if (storeInstance) {
            acc[storeId] = storeInstance;
          }
          return acc;
        },
        {},
      ),
    );

    pendingStoreIds.clear();
    batchFlushTimeout = null;

    if (Object.keys(payload).length > 0) {
      sendWhenOpen({
        type: "STATE_UPDATE",
        protocolVersion: DEVTOOLS_PROTOCOL_VERSION,
        payload,
      });
    }
  };

  const scheduleStoreFlush = () => {
    if (batchFlushTimeout) {
      return;
    }

    batchFlushTimeout = setTimeout(() => {
      flushPendingStoreUpdates();
    }, STATE_BATCH_INTERVAL_MS);
  };

  const connect = () => {
    isIntentionalDisconnect = false;
    socket = new WebSocket(url);

    socket.onopen = () => {
      console.log("[bit-form] 🔌 Conectado ao CLI DevTools via WebSocket.");

      sendWhenOpen({
        type: "HELLO",
        protocolVersion: DEVTOOLS_PROTOCOL_VERSION,
        payload: { role: "server", protocolVersion: DEVTOOLS_PROTOCOL_VERSION },
      });

      const initialState = createDevToolsSnapshotMap(bus.stores);
      if (Object.keys(initialState).length > 0) {
        sendWhenOpen({
          type: "STATE_UPDATE",
          protocolVersion: DEVTOOLS_PROTOCOL_VERSION,
          payload: initialState,
        });
      }

      unsubscribeBus = bus.subscribe((storeId, _newState) => {
        pendingStoreIds.add(storeId);
        scheduleStoreFlush();
      });

      heartbeatInterval = setInterval(() => {
        sendWhenOpen({
          type: "PING",
          protocolVersion: DEVTOOLS_PROTOCOL_VERSION,
        });
      }, 30000);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as unknown;

        if (isDevToolsActionMessage(message)) {
          const { storeId, action } = message.payload;
          const store = getDevToolsActionableStore(bus.stores, storeId);

          if (!store) {
            return;
          }

          switch (action) {
            case "undo":
              store.undo();
              break;
            case "redo":
              store.redo();
              break;
            case "reset":
              store.reset();
              break;
          }
        }
      } catch (e) {
        console.warn("[bit-form] Erro ao processar comando do CLI:", e);
      }
    };

    socket.onclose = () => {
      if (unsubscribeBus) unsubscribeBus();
      clearInterval(heartbeatInterval);
      if (batchFlushTimeout) {
        clearTimeout(batchFlushTimeout);
        batchFlushTimeout = null;
      }
      pendingStoreIds.clear();

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
    if (batchFlushTimeout) {
      clearTimeout(batchFlushTimeout);
      batchFlushTimeout = null;
    }
    pendingStoreIds.clear();
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
