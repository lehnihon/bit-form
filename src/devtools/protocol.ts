export type DevToolsActionName = "undo" | "redo" | "reset";

export const DEVTOOLS_PROTOCOL_VERSION = 1;

export interface DevToolsProtocolMessageBase {
  protocolVersion: number;
}

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

export interface DevToolsStateUpdateMessage extends DevToolsProtocolMessageBase {
  type: "STATE_UPDATE";
  payload: DevToolsStoreSnapshots;
}

export interface DevToolsPingMessage extends DevToolsProtocolMessageBase {
  type: "PING";
}

export interface DevToolsActionMessage extends DevToolsProtocolMessageBase {
  type: "ACTION";
  payload: DevToolsActionPayload;
}

export interface DevToolsHelloPayload {
  role: "client" | "server";
  protocolVersion: number;
}

export interface DevToolsHelloMessage extends DevToolsProtocolMessageBase {
  type: "HELLO";
  payload: DevToolsHelloPayload;
}

export type DevToolsRemoteMessage =
  | DevToolsStateUpdateMessage
  | DevToolsPingMessage
  | DevToolsActionMessage
  | DevToolsHelloMessage;

function hasSupportedProtocolVersion(candidate: { protocolVersion?: unknown }) {
  return candidate.protocolVersion === DEVTOOLS_PROTOCOL_VERSION;
}

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
    protocolVersion?: unknown;
  };

  return (
    candidate.type === "ACTION" &&
    hasSupportedProtocolVersion(candidate) &&
    isDevToolsActionPayload(candidate.payload)
  );
}

export function isDevToolsStateUpdateMessage(
  message: unknown,
): message is DevToolsStateUpdateMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as {
    type?: unknown;
    protocolVersion?: unknown;
  };

  return (
    candidate.type === "STATE_UPDATE" && hasSupportedProtocolVersion(candidate)
  );
}

export function isDevToolsPingMessage(
  message: unknown,
): message is DevToolsPingMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as {
    type?: unknown;
    protocolVersion?: unknown;
  };

  return candidate.type === "PING" && hasSupportedProtocolVersion(candidate);
}

export function isDevToolsHelloMessage(
  message: unknown,
): message is DevToolsHelloMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as {
    type?: unknown;
    payload?: unknown;
    protocolVersion?: unknown;
  };

  if (
    candidate.type !== "HELLO" ||
    !candidate.payload ||
    !hasSupportedProtocolVersion(candidate)
  ) {
    return false;
  }

  const payload = candidate.payload as {
    role?: unknown;
    protocolVersion?: unknown;
  };

  return (
    (payload.role === "client" || payload.role === "server") &&
    payload.protocolVersion === DEVTOOLS_PROTOCOL_VERSION
  );
}
