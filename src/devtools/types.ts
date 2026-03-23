export interface BitDevToolsOptions {
  container?: HTMLElement | string;
  mode?: "local" | "remote";
  url?: string;
  /** Custom bus instance for SSR/Edge-safe DevTools wiring. */
  bus?: import("../core").BitBus;
}

export type {
  DevToolsActionName,
  DevToolsActionPayload,
  DevToolsActionMessage,
  DevToolsPingMessage,
  DevToolsRemoteMessage,
  DevToolsStateUpdateMessage,
  DevToolsStoreSnapshot,
  DevToolsStoreSnapshots,
} from "./protocol";

export interface DevToolsActions {
  onUndo: (storeId: string) => void;
  onRedo: (storeId: string) => void;
  onReset: (storeId: string) => void;
}
