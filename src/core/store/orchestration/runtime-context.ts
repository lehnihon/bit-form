import type { BitFrameworkConfig } from "../contracts/public-types";
import type {
  BitConfig,
  BitFieldChangeMeta,
  BitFieldDefinition,
  BitPath,
  BitState,
  DeepPartial,
  BitTransformFn,
} from "../contracts/types";
import type { BitValidationTriggerOptions } from "../contracts/port-types";
import type { BitStoreOperation } from "../engines/operation-engine";
import type { BitStoreCapabilities } from "./capabilities";
import type { BitStoreEffectEngine } from "../engines/effect-engine";
import type { BitFieldRegistry } from "../registry/field-registry";
import type { BitComputedManager } from "../managers/core/computed-manager";
import type { BitDirtyManager } from "../managers/core/dirty-manager";
import type { CreateStoreRuntimeArgs } from "./store-runtime";

export interface CreateStoreRuntimeContextArgs<T extends object> {
  rawConfig: BitConfig<T>;
  config: BitFrameworkConfig<T>;
  fieldRegistry: BitFieldRegistry<T>;
  computedManager: BitComputedManager<T>;
  dirtyManager: BitDirtyManager<T>;
  initialValuesRef: {
    get(): T;
    set(values: T): void;
  };
  storeInstance: unknown;
  getState(): BitState<T>;
  dispatch(operation: BitStoreOperation<T>): void;
  setError(path: string, message: string | undefined): void;
  validate(options?: {
    scope?: string;
    scopeFields?: string[];
  }): Promise<boolean>;
  getFieldConfig(path: string): BitFieldDefinition<T> | undefined;
  getScopeFields(scopeName: string): string[];
  getEffects(): BitStoreEffectEngine<T>;
  saveHistorySnapshot(): void;
  runStateBatch<TResult>(callback: () => TResult): TResult;
  getTransformEntries(): [string, BitTransformFn<T>][];
  getHistory(): BitStoreCapabilities<T>["history"];
  getValidation(): BitStoreCapabilities<T>["validation"];
  setFieldWithMeta(path: string, value: any, meta?: BitFieldChangeMeta): void;
  unregisterPrefix(prefix: string): void;
  triggerValidation(
    scopeFields?: string[],
    options?: BitValidationTriggerOptions,
  ): void;
  getConfig(): Readonly<BitFrameworkConfig<T>>;
  getDirtyValues(): Partial<T>;
  applyPersistedValues(values: Partial<T>): void;
}

export function createStoreRuntimeContext<T extends object>(
  args: CreateStoreRuntimeContextArgs<T>,
): CreateStoreRuntimeArgs<T> {
  return {
    rawConfig: args.rawConfig,
    config: args.config,
    fieldRegistry: args.fieldRegistry,
    computedManager: args.computedManager,
    dirtyManager: args.dirtyManager,
    initialValuesRef: args.initialValuesRef,
    storeInstance: args.storeInstance,
    getState: () => args.getState(),
    dispatch: (operation) => args.dispatch(operation),
    setError: (path, message) => args.setError(path, message),
    validate: (options) => args.validate(options),
    getFieldConfig: (path) => args.getFieldConfig(path),
    getScopeFields: (scopeName) => args.getScopeFields(scopeName),
    getEffects: () => args.getEffects(),
    saveHistorySnapshot: () => args.saveHistorySnapshot(),
    runStateBatch: (callback) => args.runStateBatch(callback),
    getTransformEntries: () => args.getTransformEntries(),
    getHistory: () => args.getHistory(),
    getValidation: () => args.getValidation(),
    setFieldWithMeta: (path, value, meta) =>
      args.setFieldWithMeta(path, value, meta),
    unregisterPrefix: (prefix) => args.unregisterPrefix(prefix),
    triggerValidation: (scopeFields, options) =>
      args.triggerValidation(scopeFields, options),
    getConfig: () => args.getConfig(),
    getDirtyValues: () => args.getDirtyValues(),
    applyPersistedValues: (values) => args.applyPersistedValues(values),
  };
}
