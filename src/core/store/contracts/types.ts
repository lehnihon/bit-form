import { BitMask, BitMaskName } from "../../mask/types";

export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

export type BitErrors<T extends object> = Partial<
  Record<BitPath<T>, string | undefined>
>;
export type BitTouched<T extends object> = Partial<
  Record<BitPath<T>, boolean | undefined>
>;
export type BitComputedFn<T> = (values: T) => any;
export type BitTransformFn<T> = (value: any, allValues: T) => any;

export interface BitPersistMetadata {
  isSaving: boolean;
  isRestoring: boolean;
  error: Error | null;
}

export interface BitIdFactoryContext {
  scope: "store" | "array";
  path?: string;
  index?: number;
  storeName?: string;
}

export type BitIdFactory = (context: BitIdFactoryContext) => string;

export interface BitState<T extends object> {
  values: T;
  errors: BitErrors<T>;
  touched: BitTouched<T>;
  isValidating: Record<string, boolean>;
  persist: BitPersistMetadata;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
}

export interface BitFieldState<T extends object = any, TValue = unknown> {
  value: TValue;
  error: string | undefined;
  touched: boolean;
  isHidden: boolean;
  isRequired: boolean;
  isDirty: boolean;
  isValidating: boolean;
}

export type ValidatorFn<T extends object> = (
  values: T,
  options?: { scopeFields?: string[] },
) => Promise<BitErrors<T>> | BitErrors<T>;

/** Conditional logic: visibility and dynamic required. */
export interface BitFieldConditional<T extends object = any> {
  dependsOn?: string[];
  showIf?: (values: T) => boolean;
  requiredIf?: (values: T) => boolean;
  /** Custom message when field is required but empty. Fallback: "required field". */
  requiredMessage?: string;
}

/** Field-level validation: async validation only. */
export interface BitFieldValidation<T extends object = any> {
  asyncValidate?: (value: any, values: T) => Promise<string | null | undefined>;
  asyncValidateDelay?: number;
}

/** Full field definition: conditional, validation, transform, computed, mask, scope. */
export interface BitFieldDefinition<T extends object = any> {
  conditional?: BitFieldConditional<T>;
  validation?: BitFieldValidation<T>;
  transform?: BitTransformFn<T>;
  computed?: BitComputedFn<T>;
  /** Mask name (built-in or custom registry key) or BitMask instance. */
  mask?: BitMask | BitMaskName;
  /** Scope name (e.g. wizard step). */
  scope?: string;
}

export interface DevToolsOptions {
  enabled?: boolean;
  mode?: "local" | "remote";
  url?: string;
}

export type BitPluginHookSource =
  | "beforeValidate"
  | "afterValidate"
  | "beforeSubmit"
  | "afterSubmit"
  | "onFieldChange"
  | "setup"
  | "teardown"
  | "submit";

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
  | "swap";

export interface BitFieldChangeMeta {
  origin: BitFieldChangeOrigin;
  operation?: BitArrayOperation;
  index?: number;
  from?: number;
  to?: number;
}

export interface BitFieldChangeEvent<T extends object = any> {
  path: string;
  previousValue: unknown;
  nextValue: unknown;
  values: Readonly<T>;
  state: Readonly<BitState<T>>;
  meta: BitFieldChangeMeta;
}

export interface BitBeforeValidateEvent<T extends object = any> {
  values: Readonly<T>;
  state: Readonly<BitState<T>>;
  scope?: string;
  scopeFields?: string[];
}

export interface BitAfterValidateEvent<T extends object = any> {
  values: Readonly<T>;
  state: Readonly<BitState<T>>;
  scope?: string;
  scopeFields?: string[];
  errors: BitErrors<T>;
  result: boolean;
  aborted?: boolean;
}

export interface BitBeforeSubmitEvent<T extends object = any> {
  values: Readonly<T>;
  dirtyValues: Readonly<Partial<T>>;
  state: Readonly<BitState<T>>;
}

export interface BitAfterSubmitEvent<T extends object = any> {
  values: Readonly<T>;
  dirtyValues: Readonly<Partial<T>>;
  state: Readonly<BitState<T>>;
  success: boolean;
  error?: unknown;
  invalid?: boolean;
}

export interface BitPluginErrorEvent<T extends object = any> {
  source: BitPluginHookSource;
  pluginName?: string;
  error: unknown;
  event?: unknown;
  values: Readonly<T>;
  state: Readonly<BitState<T>>;
}

export interface BitPluginContext<T extends object = any> {
  storeId: string;
  getState: () => Readonly<BitState<T>>;
  getConfig: () => Readonly<BitConfig<T>>;
}

export interface BitPluginHooks<T extends object = any> {
  beforeValidate?: (
    event: BitBeforeValidateEvent<T>,
    context: BitPluginContext<T>,
  ) => BitMaybePromise<void>;
  afterValidate?: (
    event: BitAfterValidateEvent<T>,
    context: BitPluginContext<T>,
  ) => BitMaybePromise<void>;
  beforeSubmit?: (
    event: BitBeforeSubmitEvent<T>,
    context: BitPluginContext<T>,
  ) => BitMaybePromise<void>;
  afterSubmit?: (
    event: BitAfterSubmitEvent<T>,
    context: BitPluginContext<T>,
  ) => BitMaybePromise<void>;
  onFieldChange?: (
    event: BitFieldChangeEvent<T>,
    context: BitPluginContext<T>,
  ) => BitMaybePromise<void>;
  onError?: (
    event: BitPluginErrorEvent<T>,
    context: BitPluginContext<T>,
  ) => BitMaybePromise<void>;
}

export interface BitPlugin<T extends object = any> {
  name: string;
  setup?: (context: BitPluginContext<T>) => void | (() => void);
  hooks?: BitPluginHooks<T>;
}

export type BitMaybePromise<T> = T | Promise<T>;

export interface BitPersistStorageAdapter {
  getItem(key: string): BitMaybePromise<string | null>;
  setItem(key: string, value: string): BitMaybePromise<void>;
  removeItem(key: string): BitMaybePromise<void>;
}

export type BitPersistMode = "values" | "dirtyValues";

export interface BitPersistConfig<T extends object = any> {
  enabled?: boolean;
  key?: string;
  storage?: BitPersistStorageAdapter;
  autoSave?: boolean;
  debounceMs?: number;
  mode?: BitPersistMode;
  serialize?: (payload: unknown) => string;
  deserialize?: (raw: string) => Partial<T>;
  onError?: (error: unknown) => void;
}

export interface BitPersistResolvedConfig<T extends object = any> {
  enabled: boolean;
  key: string;
  storage?: BitPersistStorageAdapter;
  autoSave: boolean;
  debounceMs: number;
  mode: BitPersistMode;
  serialize: (payload: unknown) => string;
  deserialize: (raw: string) => Partial<T>;
  onError?: (error: unknown) => void;
}

/** Validation config. */
export interface BitValidationConfig<T extends object> {
  resolver?: ValidatorFn<T>;
  delay?: number;
}

/** History config. */
export interface BitHistoryConfig {
  enabled?: boolean;
  limit?: number;
}

/**
 * BitConfig - store configuration.
 * @see CHANGELOG for migration from features to fields in 2.0.
 */
export interface BitConfig<T extends object = any> {
  /** Core */
  name?: string;
  storeId?: string;
  idFactory?: BitIdFactory;
  initialValues?: T;

  /** Central field config: conditional, validation, transform, computed, mask, scope. */
  fields?: Record<string, BitFieldDefinition<T>>;

  /** Schema-level validation */
  validation?: BitValidationConfig<T>;

  /** History (undo/redo) */
  history?: BitHistoryConfig;

  /** DevTools */
  devTools?: boolean | DevToolsOptions;

  /** Persistência local de rascunho */
  persist?: BitPersistConfig<T>;

  /** Plugins de lifecycle (observabilidade) */
  plugins?: BitPlugin<T>[];
}

/** Return type of BitStore.getStepStatus, used by useBitScope/injectBitScope. */
export interface ScopeStatus {
  hasErrors: boolean;
  isDirty: boolean;
  errors: Record<string, string>;
}

/** Return type of validateStep, used by useBitScope/injectBitScope. */
export interface ValidateScopeResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Type-safe path utilities
 *
 * These are used to strengthen typing for field paths (e.g. "user.email", "items.0.name").
 */

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

// Builds a union of all possible dot-separated paths for a given object/array type.
export type BitPath<T, Prefix extends string = ""> = T extends Primitive
  ? never
  : T extends readonly (infer U)[]
    ? Prefix extends ""
      ? `${number}` | `${number}.${BitPath<U>}`
      : `${Prefix}.${number}` | `${Prefix}.${number}.${BitPath<U>}`
    : {
        [K in keyof T & (string | number)]: T[K] extends Primitive
          ? Prefix extends ""
            ? `${K & (string | number)}`
            : `${Prefix}.${K & (string | number)}`
          : Prefix extends ""
            ?
                | `${K & (string | number)}`
                | `${K & (string | number)}.${BitPath<T[K]>}`
            :
                | `${Prefix}.${K & (string | number)}`
                | `${Prefix}.${K & (string | number)}.${BitPath<T[K]>}`;
      }[keyof T & (string | number)];

// Resolves the value type at a given dot-separated path.
export type BitPathValue<
  T,
  P extends string,
> = P extends `${infer K}.${infer Rest}`
  ? K extends `${number}`
    ? T extends readonly (infer U)[]
      ? BitPathValue<U, Rest>
      : never
    : K extends keyof T
      ? BitPathValue<T[K], Rest>
      : never
  : P extends `${number}`
    ? T extends readonly (infer U)[]
      ? U
      : never
    : P extends keyof T
      ? T[P]
      : never;

// Filters BitPath<T> to only those paths that resolve to array types.
// Distributive over union so each path is checked individually.
export type BitArrayPath<T> =
  BitPath<T> extends infer P
    ? P extends string
      ? BitPathValue<T, P> extends readonly any[]
        ? P
        : never
      : never
    : never;

// Extracts the element type of an array.
export type BitArrayItem<A> = A extends readonly (infer U)[]
  ? U
  : A extends (infer U)[]
    ? U
    : never;
