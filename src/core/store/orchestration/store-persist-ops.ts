import { deepClone } from "../../utils";
import type { BitState } from "../contracts/types";
import {
  patchStateOperation,
  persistMetaOperation,
  type BitStoreOperation,
} from "../engines/operation-engine";
import type { BitStoreEffectEngine } from "../engines/effect-engine";
import type { BitDirtyManager } from "../managers/core/dirty-manager";
import type { BitFieldRegistry } from "../registry/field-registry";

interface ValidationAccess {
  cancelAll(): void;
  validate(): Promise<boolean>;
}

export async function restoreStorePersisted<T extends object>(args: {
  dispatch: (operation: BitStoreOperation<T>) => void;
  effects: BitStoreEffectEngine<T>;
}): Promise<boolean> {
  const { dispatch, effects } = args;

  dispatch(persistMetaOperation({ isRestoring: true, error: null }));

  try {
    return await effects.restorePersisted();
  } catch (error) {
    dispatch(
      persistMetaOperation({
        isRestoring: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }),
    );
    return false;
  } finally {
    dispatch(persistMetaOperation({ isRestoring: false }));
  }
}

export async function forceStorePersistedSave<T extends object>(args: {
  dispatch: (operation: BitStoreOperation<T>) => void;
  effects: BitStoreEffectEngine<T>;
}): Promise<void> {
  const { dispatch, effects } = args;

  dispatch(persistMetaOperation({ isSaving: true, error: null }));

  try {
    await effects.savePersistedNow();
  } catch (error) {
    dispatch(
      persistMetaOperation({
        isSaving: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }),
    );
    return;
  }

  dispatch(persistMetaOperation({ isSaving: false }));
}

export async function clearStorePersisted<T extends object>(args: {
  dispatch: (operation: BitStoreOperation<T>) => void;
  effects: BitStoreEffectEngine<T>;
}): Promise<void> {
  const { dispatch, effects } = args;

  dispatch(persistMetaOperation({ error: null }));

  try {
    await effects.clearPersisted();
  } catch (error) {
    dispatch(
      persistMetaOperation({
        error: error instanceof Error ? error : new Error(String(error)),
      }),
    );
  }
}

export function applyStorePersistedValues<T extends object>(args: {
  values: Partial<T>;
  state: BitState<T>;
  initialValues: T;
  validation: ValidationAccess;
  fieldRegistry: BitFieldRegistry<T>;
  dirtyManager: BitDirtyManager<T>;
  dispatch: (operation: BitStoreOperation<T>) => void;
  saveHistorySnapshot: () => void;
}): void {
  const {
    values,
    state,
    initialValues,
    validation,
    fieldRegistry,
    dirtyManager,
    dispatch,
    saveHistorySnapshot,
  } = args;

  const nextValues = deepClone({
    ...initialValues,
    ...values,
  } as T);

  validation.cancelAll();
  fieldRegistry.evaluateAll(nextValues);

  const isDirty = dirtyManager.rebuild(nextValues, initialValues);

  dispatch(
    patchStateOperation({
      values: nextValues,
      errors: {},
      touched: {},
      isValidating: {},
      persist: { ...state.persist, error: null },
      isValid: true,
      isDirty,
      isSubmitting: false,
    }),
  );

  saveHistorySnapshot();
  void validation.validate();
}
