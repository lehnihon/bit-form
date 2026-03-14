import {
  BitAfterValidateEvent,
  BitBeforeValidateEvent,
  BitErrors,
  BitFieldChangeEvent,
  BitFieldChangeMeta,
  BitFieldDefinition,
  BitState,
} from "./types";
import type { BitFrameworkConfig } from "./public-types";

export interface BitResolvedConfig<
  T extends object = any,
> extends BitFrameworkConfig<T> {}

export interface BitStoreAdapter<T extends object = any> {
  getState: () => BitState<T>;
  getConfig(): BitResolvedConfig<T>;
  setField(path: string, value: any): void;
  setFieldWithMeta(path: string, value: any, meta: BitFieldChangeMeta): void;
  emitFieldChange(event: BitFieldChangeEvent<T>): void;
  internalUpdateState(
    partialState: Partial<BitState<T>>,
    changedPaths?: string[],
  ): void;
  internalSaveSnapshot(): void;
  unregisterPrefix?: (prefix: string) => void;
  triggerValidation: (scopeFields?: string[]) => void;
  updateDirtyForPath: (
    path: string,
    nextValues: T,
    baselineValues: T,
  ) => boolean;
}

export interface SelectorListenerEntry<T extends object> {
  notify(nextState: Readonly<BitState<T>>): void;
}
