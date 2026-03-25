import { BitMask, BitMaskName } from "../../mask/types";
import type { BitFormGlobal } from "./bus-types";

/**
 * Pluggable scheduler used for validation debounce.
 * Replace the default (setTimeout-based) with a framework-aware scheduler
 * to integrate with React's concurrent mode, Vue's nextTick, etc.
 *
 * @example
 * // React concurrent mode integration:
 * const scheduler: BitScheduler = {
 *   schedule: (fn, delay) => {
 *     const id = setTimeout(() => startTransition(fn), delay);
 *     return () => clearTimeout(id);
 *   },
 * };
 */
export interface BitScheduler {
  /**
   * Schedule `fn` to run after `delayMs` milliseconds.
   * Must return a cleanup function that cancels the scheduled call.
   */
  schedule(fn: () => void, delayMs: number): () => void;
}

export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

export type BitErrors<T extends object> = Partial<
  Record<BitPath<T>, string | undefined>
>;
export type BitTouched<T extends object> = Partial<
  Record<BitPath<T>, boolean | undefined>
>;
type BitBivariantFn<TArgs extends unknown[], TResult> = {
  bivarianceHack(...args: TArgs): TResult;
}["bivarianceHack"];
export type BitComputedFn<T> = (values: T) => unknown;
export type BitNormalizeFn<T> = BitBivariantFn<
  [value: unknown, allValues: T],
  unknown
>;
export type BitTransformFn<T> = BitBivariantFn<
  [value: unknown, allValues: T],
  unknown
>;

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

export interface BitFieldState<
  T extends object = Record<string, unknown>,
  TValue = unknown,
> {
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
export interface BitFieldConditional<
  T extends object = Record<string, unknown>,
> {
  dependsOn?: string[];
  showIf?: (values: T) => boolean;
  requiredIf?: (values: T) => boolean;
  /** Custom message when field is required but empty. Fallback: "required field". */
  requiredMessage?: string;
}

/** Field-level validation: async validation only. */
export interface BitFieldValidation<
  T extends object = Record<string, unknown>,
> {
  /**
   * Breaking change: async validation now defaults to `blur` instead of eager `change`.
   * `validate()`/submit still execute async validators for the targeted fields.
   */
  asyncValidateOn?: "change" | "blur";
  asyncValidate?: BitBivariantFn<
    [value: unknown, values: T],
    Promise<string | null | undefined>
  >;
  asyncValidateDelay?: number;
}

interface BitFieldDefinitionBase<
  T extends object = Record<string, unknown>,
> {
  conditional?: BitFieldConditional<T>;
  validation?: BitFieldValidation<T>;
  normalize?: BitNormalizeFn<T>;
  transform?: BitTransformFn<T>;
  /** Mask name (built-in or custom registry key) or BitMask instance. */
  mask?: BitMask | BitMaskName;
  /** Scope name (e.g. wizard step). */
  scope?: string;
}

/** Full field definition: conditional, validation, transform, computed, mask, scope. */
export type BitFieldDefinition<
  T extends object = Record<string, unknown>,
> =
  | (BitFieldDefinitionBase<T> & {
      computed?: undefined;
      computedDependsOn?: never;
    })
  | (BitFieldDefinitionBase<T> & {
      computed: BitComputedFn<T>;
      /** Explicit dependencies are mandatory in v4 for deterministic computed scheduling. */
      computedDependsOn: string[];
    });

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

export interface BitPluginContext<
  T extends object = Record<string, unknown>,
> {
  storeId: string;
  getState: () => Readonly<BitState<T>>;
  getConfig: () => Readonly<BitConfig<T>>;
}

export interface BitPluginHooks<
  T extends object = Record<string, unknown>,
> {
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

export interface BitPlugin<T extends object = Record<string, unknown>> {
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

export interface BitPersistConfig<T extends object = Record<string, unknown>> {
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

export interface BitPersistResolvedConfig<
  T extends object = Record<string, unknown>,
> {
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
  /**
   * Maximum number of undo/redo steps to retain.
   * @default 50
   */
  limit?: number;
}

/**
 * BitConfig - store configuration.
 * @see CHANGELOG for migration from features to fields in 2.0.
 */
export interface BitConfig<T extends object = Record<string, unknown>> {
  /** Core */
  name?: string;
  storeId?: string;
  idFactory?: BitIdFactory;
  initialValues?: T;
  masks?: Record<string, BitMask>;

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

  /**
   * Maximum number of entries for internal subscription path caches.
   * Lower = less memory; higher = fewer cache evictions in large dynamic forms.
   * @default 500
   */
  subscriptionCacheSize?: number;

  /**
   * Pluggable scheduler for validation debounce.
   * Defaults to a `setTimeout`-based scheduler.
   * Inject a framework-aware scheduler (e.g. React `startTransition`) for
   * better integration with concurrent rendering.
   */
  scheduler?: BitScheduler;

  /**
   * Custom bus instance for DevTools/observability. When omitted, the
   * shared browser-global bus (`bitBus`) is used — suitable for most apps.
   * Pass a `createBitBus()` instance when running in SSR/Edge environments
   * where a global singleton is unsafe (e.g. Next.js Edge Runtime).
   */
  bus?: BitFormGlobal;

  /**
   * Handler opcional para erros operacionais não tratados internamente.
   * Se não informado, o runtime usa fallback para `console.error`.
   */
  onUnhandledError?: (error: unknown, source: "submit") => void;
}

export type BitSubmitResult =
  | { status: "submitted" }
  | { status: "invalid" }
  | { status: "failed"; error: unknown }
  | { status: "blocked"; reason: "isSubmitting" | "validating" };

/** Return type of BitStore.getScopeStatus, used by useBitScope/injectBitScope. */
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
      ? BitPathValue<T, P> extends readonly unknown[]
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
