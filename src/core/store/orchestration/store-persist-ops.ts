import { deepClone, deepMerge } from "../../utils";
import type { BitState } from "../contracts/types";
import type { BitStoreEffectEngine } from "../engines/effect-engine";
import {
  patchStateOperation,
  persistMetaOperation,
  type BitStoreOperation,
} from "../engines/operation-engine";
import type { BitDirtyManager } from "../managers/core/dirty-manager";
import type { BitFieldRegistry } from "../registry/field-registry";

interface ValidationAccess {
  cancelAll(): void;
  validate(): Promise<boolean>;
}

// NOTA: Estes WeakMaps são module-level intencionalmente.
// A chave `dispatch` é sempre uma closure única por instância de store em produção.
// Em testes, garanta que cada `createStore()` use um mock de dispatch diferente
// para evitar vazamento de estado `isRestoring` entre testes.
const activeRestoringOpsByDispatch = new WeakMap<Function, number>();
const lastRestoringErrorByDispatch = new WeakMap<Function, Error | null>();

function beginPersistOperation<T extends object>(args: {
  dispatch: (operation: BitStoreOperation<T>) => void;
  type: "restoring";
}): void {
  const { dispatch } = args;
  const map = activeRestoringOpsByDispatch;
  const errorMap = lastRestoringErrorByDispatch;
  const active = map.get(dispatch) ?? 0;

  map.set(dispatch, active + 1);

  if (active === 0) {
    errorMap.set(dispatch, null);
    dispatch(
      persistMetaOperation({
        isRestoring: true,
        error: null,
      }),
    );
  }
}

function finalizePersistOperation<T extends object>(args: {
  dispatch: (operation: BitStoreOperation<T>) => void;
  type: "restoring";
  error: Error | null;
}): void {
  const { dispatch, error } = args;
  const map = activeRestoringOpsByDispatch;
  const errorMap = lastRestoringErrorByDispatch;
  const active = map.get(dispatch) ?? 0;

  if (active <= 0) {
    return;
  }

  const nextActive = active - 1;

  if (error) {
    errorMap.set(dispatch, error);
  }

  if (nextActive > 0) {
    map.set(dispatch, nextActive);
    const pendingError = errorMap.get(dispatch) ?? null;
    if (pendingError) {
      dispatch(persistMetaOperation({ error: pendingError }));
    }
    return;
  }

  map.delete(dispatch);

  // If the last active operation succeeded, clear any stale concurrent error.
  if (!error) {
    errorMap.set(dispatch, null);
  }

  const finalError = errorMap.get(dispatch) ?? null;
  errorMap.delete(dispatch);

  dispatch(
    persistMetaOperation({
      isRestoring: false,
      error: finalError,
    }),
  );
}

export async function restoreStorePersisted<T extends object>(args: {
  dispatch: (operation: BitStoreOperation<T>) => void;
  effects: BitStoreEffectEngine<T>;
  onUnhandledError?: (error: unknown, source: string) => void;
}): Promise<boolean> {
  const { dispatch, effects, onUnhandledError } = args;
  beginPersistOperation({ dispatch, type: "restoring" });

  let operationError: Error | null = null;

  try {
    return await effects.restorePersisted();
  } catch (error) {
    operationError = error instanceof Error ? error : new Error(String(error));
    // Route to global error handler so observability tools (Sentry, Datadog,
    // etc.) capture the failure — the UI metadata update alone is not enough.
    onUnhandledError?.(operationError, "persist");
    return false;
  } finally {
    finalizePersistOperation({
      dispatch,
      type: "restoring",
      error: operationError,
    });
  }
}

export async function forceStorePersistedSave<T extends object>(args: {
  dispatch: (operation: BitStoreOperation<T>) => void;
  effects: BitStoreEffectEngine<T>;
  onUnhandledError?: (error: unknown, source: string) => void;
}): Promise<void> {
  const { effects, onUnhandledError } = args;

  try {
    await effects.savePersistedNow();
  } catch (error) {
    // Route to global error handler so observability tools capture the failure,
    // then re-throw so the caller can react (e.g., show an error message).
    onUnhandledError?.(error, "persist");
    throw error;
  }
}

export async function clearStorePersisted<T extends object>(args: {
  dispatch: (operation: BitStoreOperation<T>) => void;
  effects: BitStoreEffectEngine<T>;
  onUnhandledError?: (error: unknown, source: string) => void;
}): Promise<void> {
  const { effects, onUnhandledError } = args;

  try {
    await effects.clearPersisted();
  } catch (error) {
    // Route to global error handler so observability tools capture the failure,
    // then re-throw so the caller can react (e.g., show an error message).
    onUnhandledError?.(error, "persist");
    throw error;
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

  const nextValues = deepClone(deepMerge(initialValues, values));

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
      isValid: false,
      isDirty,
    }),
  );

  saveHistorySnapshot();
  void validation.validate();
}
