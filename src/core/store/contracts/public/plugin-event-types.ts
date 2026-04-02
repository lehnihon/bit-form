import type { BitErrors, BitState } from "./state-types";

export type BitPluginHookSource =
  | "beforeValidate"
  | "afterValidate"
  | "beforeSubmit"
  | "afterSubmit"
  | "onFieldChange"
  | "setup"
  | "teardown"
  | "submit";

export type BitOperationalErrorSource =
  | "submit"
  | "validation"
  | "persist"
  | (string & {});

export type BitFieldChangeOrigin =
  | "setField"
  | "rebase"
  | "replaceValues"
  | "hydrate"
  | "array";

export type BitArrayOperation =
  | "push"
  | "prepend"
  | "insert"
  | "remove"
  | "move"
  | "swap"
  | "replace"
  | "clear";

export interface BitFieldChangeMeta {
  origin: BitFieldChangeOrigin;
  operation?: BitArrayOperation;
  index?: number;
  from?: number;
  to?: number;
}

export interface BitFieldChangeEvent<
  T extends object = Record<string, unknown>,
> {
  path: string;
  previousValue: unknown;
  nextValue: unknown;
  values: Readonly<T>;
  state: Readonly<BitState<T>>;
  meta: BitFieldChangeMeta;
}

export interface BitBeforeValidateEvent<
  T extends object = Record<string, unknown>,
> {
  values: Readonly<T>;
  state: Readonly<BitState<T>>;
  scope?: string;
  scopeFields?: string[];
}

export interface BitAfterValidateEvent<
  T extends object = Record<string, unknown>,
> {
  values: Readonly<T>;
  state: Readonly<BitState<T>>;
  scope?: string;
  scopeFields?: string[];
  errors: BitErrors<T>;
  result: boolean;
  aborted?: boolean;
}

export interface BitBeforeSubmitEvent<
  T extends object = Record<string, unknown>,
> {
  values: Readonly<T>;
  dirtyValues: Readonly<Partial<T>>;
  state: Readonly<BitState<T>>;
}

export interface BitAfterSubmitEvent<
  T extends object = Record<string, unknown>,
> {
  values: Readonly<T>;
  dirtyValues: Readonly<Partial<T>>;
  state: Readonly<BitState<T>>;
  success: boolean;
  error?: unknown;
  invalid?: boolean;
}

export interface BitPluginErrorEvent<
  T extends object = Record<string, unknown>,
> {
  source: BitPluginHookSource;
  pluginName?: string;
  error: unknown;
  event?: unknown;
  values: Readonly<T>;
  state: Readonly<BitState<T>>;
}
