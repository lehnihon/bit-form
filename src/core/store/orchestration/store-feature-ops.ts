import type { BitHistoryMetadata } from "../contracts/public/meta-types";
import type { BitStoreEffectEngine } from "../engines/effect-engine";
import type { BitStoreOperation } from "../engines/operation-engine";
import {
  clearStorePersisted,
  forceStorePersistedSave,
  restoreStorePersisted,
} from "./store-persist-ops";

export function restorePersistedFeature<T extends object>(args: {
  dispatch: (operation: BitStoreOperation<T>) => void;
  effects: BitStoreEffectEngine<T>;
  onUnhandledError?: (error: unknown, source: string) => void;
}): Promise<boolean> {
  const { dispatch, effects, onUnhandledError } = args;
  return restoreStorePersisted({ dispatch, effects, onUnhandledError });
}

export function forceSavePersistedFeature<T extends object>(args: {
  dispatch: (operation: BitStoreOperation<T>) => void;
  effects: BitStoreEffectEngine<T>;
  onUnhandledError?: (error: unknown, source: string) => void;
}): Promise<void> {
  const { dispatch, effects, onUnhandledError } = args;
  return forceStorePersistedSave({ dispatch, effects, onUnhandledError });
}

export function clearPersistedFeature<T extends object>(args: {
  dispatch: (operation: BitStoreOperation<T>) => void;
  effects: BitStoreEffectEngine<T>;
  onUnhandledError?: (error: unknown, source: string) => void;
}): Promise<void> {
  const { dispatch, effects, onUnhandledError } = args;
  return clearStorePersisted({ dispatch, effects, onUnhandledError });
}

type HistoryFeaturePort<T extends object> = {
  undo: () => T | null;
  redo: () => T | null;
  getMetadata: () => BitHistoryMetadata;
};

export function runUndoFeature<T extends object>(args: {
  history: HistoryFeaturePort<T>;
  applyHistoryState: (values: T) => void;
}): void {
  const { history, applyHistoryState } = args;
  const prevState = history.undo();
  if (prevState) {
    applyHistoryState(prevState);
  }
}

export function runRedoFeature<T extends object>(args: {
  history: HistoryFeaturePort<T>;
  applyHistoryState: (values: T) => void;
}): void {
  const { history, applyHistoryState } = args;
  const nextState = history.redo();
  if (nextState) {
    applyHistoryState(nextState);
  }
}

export function readHistoryFeatureMetadata<T extends object>(args: {
  history: HistoryFeaturePort<T>;
}): BitHistoryMetadata {
  return args.history.getMetadata();
}
