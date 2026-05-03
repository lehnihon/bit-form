import { deepClone } from "../../utils";
import type { BitValidationTriggerOptions } from "../contracts/port-types";
import type {
  BitFormMeta,
  BitHistoryMetadata,
  BitServerErrorOptions,
  BitValidationOptions,
} from "../contracts/public/meta-types";
import type { BitFrameworkConfig } from "../contracts/public/store-api-types";
import type {
  BitScopedSelectorSubscriptionOptions,
  BitSelector,
  BitSelectorSubscriptionOptions,
} from "../contracts/public/subscription-types";
import type {
  BitArrayItem,
  BitArrayPath,
  BitErrors,
  BitFieldDefinition,
  BitFieldState,
  BitPath,
  BitPathValue,
  BitPersistMetadata,
  BitSubmitResult,
  DeepPartial,
  ScopeStatus,
} from "../contracts/types";
import {
  touchFieldsOperation,
  type BitStoreOperation,
} from "../engines/operation-engine";
import type { BitDirtyManager } from "../managers/core/dirty-manager";
import type { BitFieldRegistry } from "../registry/field-registry";
import type { BitStoreStateReader } from "../shared/store-state-reader";
import {
  clearPersistedFeature,
  forceSavePersistedFeature,
  readHistoryFeatureMetadata,
  restorePersistedFeature,
  runRedoFeature,
  runUndoFeature,
} from "./store-feature-ops";
import {
  subscribeStoreFieldState,
  subscribeStoreFormMeta,
  subscribeStoreHistoryMeta,
  subscribeStorePath,
  subscribeStorePersistMeta,
  subscribeStoreScopeStatus,
  subscribeStoreSelector,
} from "./store-observe-ops";
import {
  registerStoreField,
  unregisterStoreField,
  unregisterStorePrefix,
} from "./store-registration-ops";
import type { BitStoreRuntimeKernel } from "./store-runtime-kernel";

export interface BitStoreReadDomain<T extends object> {
  getState(): ReturnType<BitStoreStateReader<T>["getState"]>;
  getFieldState<P extends BitPath<T>>(
    path: P,
  ): BitFieldState<T, BitPathValue<T, P>>;
  getIsValid(): boolean;
  getIsSubmitting(): boolean;
  getIsDirty(): boolean;
  isHidden<P extends BitPath<T>>(path: P): boolean;
  isRequired<P extends BitPath<T>>(path: P): boolean;
  isFieldDirty(path: string): boolean;
  isFieldValidating(path: string): boolean;
  getDirtyValues(): Partial<T>;
  getPersistMetadata(): BitPersistMetadata;
  getHistoryMetadata(): BitHistoryMetadata;
  getScopeStatus(scopeName: string): ScopeStatus;
  getScopeErrors(scopeName: string): Record<string, string>;
  getCanUndo(): boolean;
  getCanRedo(): boolean;
  getScopeFields(scopeName: string): string[];
}

export interface BitStoreObserveDomain<T extends object> {
  subscribe(listener: () => void): () => void;
  subscribePersistMeta(
    listener: (meta: BitPersistMetadata) => void,
  ): () => void;
  subscribeHistoryMeta(
    listener: (meta: BitHistoryMetadata) => void,
  ): () => void;
  subscribeScopeStatus(
    scopeName: string,
    listener: (status: ScopeStatus) => void,
  ): () => void;
  subscribeSelector<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options: BitSelectorSubscriptionOptions<TSlice>,
  ): () => void;
  subscribePath<P extends BitPath<T>>(
    path: P,
    listener: (value: BitPathValue<T, P>) => void,
    options?: BitScopedSelectorSubscriptionOptions<BitPathValue<T, P>>,
  ): () => void;
  subscribeFieldState<P extends BitPath<T>>(
    path: P,
    listener: (state: Readonly<BitFieldState<T, BitPathValue<T, P>>>) => void,
  ): () => void;
  subscribeFormMeta(listener: (meta: BitFormMeta) => void): () => void;
}

export interface BitStoreWriteDomain<T extends object> {
  registerField(path: string, config: BitFieldDefinition<T>): void;
  unregisterField(path: string): void;
  unregisterPrefix(prefix: string): void;
  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>): void;
  blurField<P extends BitPath<T>>(path: P): void;
  markFieldsTouched(paths: string[]): void;
  setValues(
    values: T | DeepPartial<T>,
    options?: { partial?: boolean; rebase?: boolean },
  ): void;
  setError(path: string, message: string | undefined): void;
  setErrors(errors: BitErrors<T>): void;
  setServerErrors(
    serverErrors: Record<string, string[] | string>,
    options?: BitServerErrorOptions,
  ): void;
  reset(): void;
  transaction<TResult>(callback: () => TResult): TResult;
  submit(
    onSuccess: (
      values: T,
      dirtyValues?: Partial<T>,
    ) => unknown | Promise<unknown>,
  ): Promise<BitSubmitResult>;
  pushItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ): void;
  prependItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ): void;
  insertItem<P extends BitArrayPath<T>>(
    path: P,
    index: number,
    value: BitArrayItem<BitPathValue<T, P>>,
  ): void;
  removeItem<P extends BitArrayPath<T>>(path: P, index: number): void;
  swapItems<P extends BitArrayPath<T>>(
    path: P,
    indexA: number,
    indexB: number,
  ): void;
  moveItem<P extends BitArrayPath<T>>(path: P, from: number, to: number): void;
  replaceItems<P extends BitArrayPath<T>>(
    path: P,
    items: BitArrayItem<BitPathValue<T, P>>[],
  ): void;
  clearItems<P extends BitArrayPath<T>>(path: P): void;
}

export interface BitStoreFeatureDomain<_T extends object> {
  undo(): void;
  redo(): void;
  validate(options?: BitValidationOptions): Promise<boolean>;
  hasValidationsInProgress(scopeFields?: string[]): boolean;
  triggerValidation(
    scopeFields?: string[],
    options?: BitValidationTriggerOptions,
  ): void;
  restorePersisted(): Promise<boolean>;
  forceSave(): Promise<void>;
  clearPersisted(): Promise<void>;
  getArrayItemIds(path: string, length?: number): string[];
  cleanup(): void;
}

export interface BitStoreDomains<T extends object> {
  read: BitStoreReadDomain<T>;
  observe: BitStoreObserveDomain<T>;
  write: BitStoreWriteDomain<T>;
  feature: BitStoreFeatureDomain<T>;
}

export function createBitStoreDomains<T extends object>(args: {
  runtime: BitStoreRuntimeKernel<T>;
  config: BitFrameworkConfig<T>;
  fieldRegistry: BitFieldRegistry<T>;
  dirtyManager: BitDirtyManager<T>;
  stateReader: BitStoreStateReader<T>;
}): BitStoreDomains<T> {
  const { runtime, config, fieldRegistry, dirtyManager, stateReader } = args;

  const readDomain: BitStoreReadDomain<T> = {
    getState: () => deepClone(stateReader.getState()),
    getFieldState: (path) => deepClone(stateReader.getFieldState(path)),
    getIsValid: () => stateReader.getFlag("isValid"),
    getIsSubmitting: () => stateReader.getFlag("isSubmitting"),
    getIsDirty: () => stateReader.getFlag("isDirty"),
    isHidden: (path) => runtime.capabilities.query.isHidden(path),
    isRequired: (path) => runtime.capabilities.query.isRequired(path),
    isFieldDirty: (path) => runtime.capabilities.query.isFieldDirty(path),
    isFieldValidating: (path) =>
      runtime.capabilities.query.isFieldValidating(path),
    getDirtyValues: () =>
      dirtyManager.buildDirtyValues(stateReader.getState().values),
    getPersistMetadata: () => stateReader.getPersistMetadata(),
    getHistoryMetadata: () =>
      readHistoryFeatureMetadata({ history: runtime.capabilities.history }),
    getScopeStatus: (scopeName) =>
      runtime.capabilities.scope.getScopeStatus(scopeName),
    getScopeErrors: (scopeName) =>
      runtime.capabilities.scope.getScopeErrors(scopeName),
    getCanUndo: () => runtime.capabilities.history.canUndo,
    getCanRedo: () => runtime.capabilities.history.canRedo,
    getScopeFields: (scopeName) =>
      fieldRegistry.getScopeFields(scopeName, stateReader.getState().values),
  };

  const observeDomain: BitStoreObserveDomain<T> = {
    subscribe: (listener) => runtime.subscriptions.subscribe(listener),
    subscribePersistMeta: (listener) =>
      subscribeStorePersistMeta({
        listener,
        subscribeSelector: (selector, persistListener, options) =>
          observeDomain.subscribeSelector(selector, persistListener, options),
      }),
    subscribeHistoryMeta: (listener) =>
      subscribeStoreHistoryMeta({
        readHistoryMeta: () => readDomain.getHistoryMetadata(),
        subscribeSelector: (selector, historyListener, options) =>
          observeDomain.subscribeSelector(selector, historyListener, options),
        listener,
      }),
    subscribeScopeStatus: (scopeName, listener) =>
      subscribeStoreScopeStatus({
        scopeName,
        getScopeFields: (name) => readDomain.getScopeFields(name),
        readScopeStatus: (name) => readDomain.getScopeStatus(name),
        subscribeSelector: (selector, scopeListener, options) =>
          observeDomain.subscribeSelector(selector, scopeListener, options),
        listener,
      }),
    subscribeSelector: (selector, listener, options) =>
      subscribeStoreSelector({
        getState: () => readDomain.getState(),
        subscriptions: runtime.subscriptions,
        selector,
        listener,
        options,
        trackedSubscriptionsEnabled: !!config.trackedSubscriptions,
        onUnhandledError: (error, source) =>
          config.onUnhandledError(error, source),
      }),
    subscribePath: (path, listener, options) =>
      subscribeStorePath({
        path,
        listener,
        options,
        subscribeSelector: (selector, pathListener, selectorOptions) =>
          observeDomain.subscribeSelector(
            selector,
            pathListener,
            selectorOptions,
          ),
      }),
    subscribeFieldState: (path, listener) =>
      subscribeStoreFieldState({
        path,
        listener,
        getFieldState: (fieldPath) => readDomain.getFieldState(fieldPath),
        subscribeSelector: (selector, fieldListener, options) =>
          observeDomain.subscribeSelector(selector, fieldListener, options),
      }),
    subscribeFormMeta: (listener) =>
      subscribeStoreFormMeta({
        listener,
        subscribeSelector: (selector, metaListener, options) =>
          observeDomain.subscribeSelector(selector, metaListener, options),
      }),
  };

  const writeDomain: BitStoreWriteDomain<T> = {
    registerField: (path, fieldConfig) => {
      registerStoreField({
        path,
        config: fieldConfig,
        state: runtime.getState(),
        fieldRegistry,
        subscriptions: runtime.subscriptions,
        validationCleanupField: (fieldPath) =>
          runtime.capabilities.validation.cleanupField(fieldPath),
        stateReader,
        invalidateFieldIndexes: () => {
          fieldRegistry.invalidateIndexes();
        },
        dispatch: (operation) => runtime.dispatch(operation),
        getState: () => runtime.getState(),
        onUnhandledError: (error, source) =>
          config.onUnhandledError(error, source),
      });
    },
    unregisterField: (path) => {
      unregisterStoreField({
        path,
        state: runtime.getState(),
        hasStaticConfig: !!config.fields?.[path as string],
        fieldRegistry,
        subscriptions: runtime.subscriptions,
        validationCleanupField: (fieldPath) =>
          runtime.capabilities.validation.cleanupField(fieldPath),
        invalidateFieldIndexes: () => {
          fieldRegistry.invalidateIndexes();
        },
        dispatch: (operation) => runtime.dispatch(operation),
      });
    },
    unregisterPrefix: (prefix) => {
      unregisterStorePrefix({
        prefix,
        state: runtime.getState(),
        fieldRegistry,
        subscriptions: runtime.subscriptions,
        validationCleanupPrefix: (fieldPrefix) =>
          runtime.capabilities.validation.cleanupPrefix(fieldPrefix),
        invalidateFieldIndexes: () => {
          fieldRegistry.invalidateIndexes();
        },
        hasStaticConfigPath: (path) =>
          !!config.fields?.[path as keyof typeof config.fields],
        dispatch: (operation) => runtime.dispatch(operation),
      });
    },
    setField: (path, value) => {
      runtime.runBatch(() => {
        runtime.capabilities.lifecycle.updateField(path as string, value, {
          origin: "setField",
        });
      });
    },
    blurField: (path) => {
      if (!runtime.capabilities.query.isTouched(path as string)) {
        runtime.runBatch(() => {
          runtime.dispatch(touchFieldsOperation([path as string]));
        });
      }

      runtime.flushPendingHistorySnapshot();
      runtime.capabilities.validation.trigger([path]);
    },
    markFieldsTouched: (paths) => {
      if (paths.length === 0) return;
      runtime.dispatch(touchFieldsOperation(paths));
    },
    setValues: (values, options) => {
      if (options?.rebase) {
        runtime.flushPendingHistorySnapshot();
      }

      runtime.capabilities.lifecycle.setValues(values, options);
    },
    setError: (path, message) => {
      runtime.capabilities.error.setError(path, message);
    },
    setErrors: (errors) => {
      runtime.capabilities.error.setErrors(errors);
    },
    setServerErrors: (serverErrors, options) => {
      runtime.capabilities.error.setServerErrors(serverErrors, options);
    },
    reset: () => {
      runtime.flushPendingHistorySnapshot();
      runtime.runBatch(() => {
        runtime.capabilities.lifecycle.reset();
        runtime.cancelPendingHistorySnapshot();
      });
    },
    transaction: (callback) => runtime.runBatch(callback),
    submit: (onSuccess) => {
      runtime.flushPendingHistorySnapshot();
      return runtime.capabilities.lifecycle.submit(onSuccess);
    },
    pushItem: (path, value) =>
      runtime.capabilities.arrays.pushItem(path, value),
    prependItem: (path, value) =>
      runtime.capabilities.arrays.prependItem(path, value),
    insertItem: (path, index, value) =>
      runtime.capabilities.arrays.insertItem(path, index, value),
    removeItem: (path, index) =>
      runtime.capabilities.arrays.removeItem(path, index),
    swapItems: (path, indexA, indexB) =>
      runtime.capabilities.arrays.swapItems(path, indexA, indexB),
    moveItem: (path, from, to) =>
      runtime.capabilities.arrays.moveItem(path, from, to),
    replaceItems: (path, items) =>
      runtime.capabilities.arrays.replaceItems(path, items),
    clearItems: (path) => runtime.capabilities.arrays.clearItems(path),
  };

  const featureDispatch = (operation: BitStoreOperation<T>) =>
    runtime.dispatch(operation);

  const featureDomain: BitStoreFeatureDomain<T> = {
    undo: () => {
      runtime.flushPendingHistorySnapshot();
      runUndoFeature({
        history: runtime.capabilities.history,
        applyHistoryState: (values) =>
          runtime.capabilities.lifecycle.applyHistoryState(values),
      });
    },
    redo: () => {
      runtime.flushPendingHistorySnapshot();
      runRedoFeature({
        history: runtime.capabilities.history,
        applyHistoryState: (values) =>
          runtime.capabilities.lifecycle.applyHistoryState(values),
      });
    },
    validate: (options) => runtime.capabilities.validation.validate(options),
    hasValidationsInProgress: (scopeFields) =>
      runtime.capabilities.validation.hasValidationsInProgress(scopeFields),
    triggerValidation: (scopeFields, options) =>
      runtime.capabilities.validation.trigger(scopeFields, options),
    restorePersisted: () =>
      restorePersistedFeature({
        dispatch: featureDispatch,
        effects: runtime.effects,
        onUnhandledError: (error, source) =>
          config.onUnhandledError(error, source),
      }),
    forceSave: () =>
      forceSavePersistedFeature({
        dispatch: featureDispatch,
        effects: runtime.effects,
        onUnhandledError: (error, source) =>
          config.onUnhandledError(error, source),
      }),
    clearPersisted: () =>
      clearPersistedFeature({
        dispatch: featureDispatch,
        effects: runtime.effects,
        onUnhandledError: (error, source) =>
          config.onUnhandledError(error, source),
      }),
    getArrayItemIds: (path, length) =>
      runtime.capabilities.arrays.getItemIds(path, length),
    cleanup: () => runtime.cleanup(),
  };

  return {
    read: readDomain,
    observe: observeDomain,
    write: writeDomain,
    feature: featureDomain,
  };
}
