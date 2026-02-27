export interface BitDevToolsOptions {
  container?: HTMLElement | string;
  mode?: "local" | "remote";
  url?: string;
}

export interface DevToolsActions {
  onUndo: (storeId: string) => void;
  onRedo: (storeId: string) => void;
  onReset: (storeId: string) => void;
}
