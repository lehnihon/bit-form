import { BitDependencyManager } from "./dependency-manager";
import { BitDirtyManager } from "./dirty-manager";
import { BitHistoryManager } from "./history-manager";
import { BitValidationManager } from "./validation-manager";
import { BitResolvedConfig, BitState } from "./types";

export interface BitLifecycleAdapter<T extends object> {
  getState: () => BitState<T>;
  internalUpdateState: (partial: Partial<BitState<T>>) => void;
  internalSaveSnapshot: () => void;
  config: BitResolvedConfig<T>;
  depsMg: BitDependencyManager<T>;
  validatorMg: BitValidationManager<T>;
  historyMg: BitHistoryManager<T>;
  dirtyMg: BitDirtyManager<T>;
}

export interface BitStoreAdapter<T extends object = any> {
  getState: () => BitState<T>;
  getConfig(): BitResolvedConfig<T>;
  setField(path: string, value: any): void;
  internalUpdateState(partialState: any): void;
  internalSaveSnapshot(): void;
  unregisterPrefix?: (prefix: string) => void;
  validate?: () => Promise<boolean>;
  dirtyMg: BitDirtyManager<T>;
}

export interface BitValidationAdapter<T extends object> {
  getState: () => BitState<T>;
  internalUpdateState: (partial: Partial<BitState<T>>) => void;
  setError: (path: string, message: string | undefined) => void;
  validate?: (opts: { scopeFields?: string[] }) => Promise<boolean>;
  config: BitResolvedConfig<T>;
  depsMg: BitDependencyManager<T>;
}
