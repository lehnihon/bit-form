export interface BitDevToolsOptions {
  container?: HTMLElement | string;
  mode?: "local" | "remote";
  url?: string;
}

export type DevToolsActionName = "undo" | "redo" | "reset";

export interface DevToolsActionPayload {
  storeId: string;
  action: DevToolsActionName;
}

export interface DevToolsStateUpdateMessage {
  type: "STATE_UPDATE";
  payload: Record<string, unknown>;
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

export interface DevToolsActions {
  onUndo: (storeId: string) => void;
  onRedo: (storeId: string) => void;
  onReset: (storeId: string) => void;
}
