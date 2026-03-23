export type DevToolsActionName = "undo" | "redo" | "reset";

export interface DevToolsHistoryMeta {
  canUndo: boolean;
  canRedo: boolean;
  totalSteps: number;
  currentIndex: number;
}

export interface DevToolsStoreSnapshot {
  values: unknown;
  errors: Record<string, unknown>;
  touched: Record<string, unknown>;
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
  isValidating?: Record<string, unknown>;
  persist?: unknown;
  _meta: DevToolsHistoryMeta;
}

export type DevToolsStoreSnapshots = Record<string, DevToolsStoreSnapshot>;

export interface DevToolsActionPayload {
  storeId: string;
  action: DevToolsActionName;
}

export interface DevToolsStateUpdateMessage {
  type: "STATE_UPDATE";
  payload: DevToolsStoreSnapshots;
}

export interface DevToolsPingMessage {
  type: "PING";
}

export interface DevToolsActionMessage {
  type: "ACTION";
  payload: DevToolsActionPayload;
}

export type DevToolsRemoteMessage =
  | DevToolsStateUpdateMessage
  | DevToolsPingMessage
  | DevToolsActionMessage;

export function isDevToolsActionPayload(
  payload: unknown,
): payload is DevToolsActionPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as {
    storeId?: unknown;
    action?: unknown;
  };

  return (
    typeof candidate.storeId === "string" &&
    (candidate.action === "undo" ||
      candidate.action === "redo" ||
      candidate.action === "reset")
  );
}

export function isDevToolsActionMessage(
  message: unknown,
): message is DevToolsActionMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as {
    type?: unknown;
    payload?: unknown;
  };

  return (
    candidate.type === "ACTION" && isDevToolsActionPayload(candidate.payload)
  );
}

export function isDevToolsStateUpdateMessage(
  message: unknown,
): message is DevToolsStateUpdateMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  return (message as { type?: unknown }).type === "STATE_UPDATE";
}

export function isDevToolsPingMessage(
  message: unknown,
): message is DevToolsPingMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  return (message as { type?: unknown }).type === "PING";
}
