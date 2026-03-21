import { bitBus } from "../core";
import type { BitFormGlobal } from "../core/store/contracts/bus-types";
import type { DevToolsActionName, DevToolsActionPayload } from "./types";

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
const STATE_BATCH_INTERVAL_MS = 50;

const isDevToolsActionPayload = (
  payload: unknown,
): payload is DevToolsActionPayload => {
  if (!payload || typeof payload !== "object") return false;

  const { storeId, action } = payload as {
    storeId?: unknown;
    action?: unknown;
  };

  return (
    typeof storeId === "string" &&
    (action === "undo" || action === "redo" || action === "reset")
  );
};

export function setupRemoteBridge(url: string, bus: BitFormGlobal = bitBus) {
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

    const payload: Record<string, unknown> = {};

    pendingStoreIds.forEach((storeId) => {
      const storeInstance = bus.stores[storeId];
      if (!storeInstance) {
        return;
      }

      payload[storeId] = formatStoreState(storeInstance);
    });

    pendingStoreIds.clear();
    batchFlushTimeout = null;

    if (Object.keys(payload).length > 0) {
      sendWhenOpen({ type: "STATE_UPDATE", payload });
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

      const storesEntries = Object.entries(bus.stores);
      if (storesEntries.length > 0) {
        const initialState = storesEntries.reduce(
          (acc, [id, store]) => {
            acc[id] = formatStoreState(store);
            return acc;
          },
          {} as Record<string, any>,
        );

        sendWhenOpen({ type: "STATE_UPDATE", payload: initialState });
      }

      unsubscribeBus = bus.subscribe((storeId, _newState) => {
        pendingStoreIds.add(storeId);
        scheduleStoreFlush();
      });

      heartbeatInterval = setInterval(() => {
        sendWhenOpen({ type: "PING" });
      }, 30000);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as {
          type?: unknown;
          payload?: unknown;
        };

        if (message.type === "ACTION") {
          if (!isDevToolsActionPayload(message.payload)) {
            return;
          }

          const { storeId, action } = message.payload;

          const store = bus.stores[storeId];

          if (!store || typeof store !== "object") {
            return;
          }

          const methodByAction: Record<DevToolsActionName, string> = {
            undo: "undo",
            redo: "redo",
            reset: "reset",
          };

          const method = (store as Record<string, unknown>)[
            methodByAction[action]
          ];
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
