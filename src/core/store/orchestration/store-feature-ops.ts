import type { BitHistoryMetadata } from "../contracts/public/meta-types";
import type { BitStoreOperation } from "../engines/operation-engine";
import type { BitStoreEffectEngine } from "../engines/effect-engine";
import {
  clearStorePersisted,
  forceStorePersistedSave,
  restoreStorePersisted,
} from "./store-persist-ops";

export function restorePersistedFeature<T extends object>(args: {
  dispatch: (operation: BitStoreOperation<T>) => void;
  effects: BitStoreEffectEngine<T>;
}): Promise<boolean> {
  const { dispatch, effects } = args;
  return restoreStorePersisted({ dispatch, effects });
}

export function forceSavePersistedFeature<T extends object>(args: {
  dispatch: (operation: BitStoreOperation<T>) => void;
  effects: BitStoreEffectEngine<T>;
}): Promise<void> {
  const { dispatch, effects } = args;
  return forceStorePersistedSave({ dispatch, effects });
}

export function clearPersistedFeature<T extends object>(args: {
  dispatch: (operation: BitStoreOperation<T>) => void;
  effects: BitStoreEffectEngine<T>;
}): Promise<void> {
  const { dispatch, effects } = args;
  return clearStorePersisted({ dispatch, effects });
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
