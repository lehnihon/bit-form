import { BitMask } from "../mask/types";
import { BitDependencyManager } from "./dependency-manager";
import { BitHistoryManager } from "./history-manager";
import { BitValidationManager } from "./validation-manager";

export type BitErrors<T> = { [key: string]: string | undefined };
export type BitTouched<T> = { [key: string]: boolean | undefined };
export type BitComputedFn<T> = (values: T) => any;
export type BitTransformFn<T> = (value: any, allValues: T) => any;

export interface BitState<T> {
  values: T;
  errors: BitErrors<T>;
  touched: BitTouched<T>;
  isValidating: Record<string, boolean>;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
}

export type ValidatorFn<T> = (
  values: T,
  options?: { scopeFields?: string[] },
) => Promise<BitErrors<T>> | BitErrors<T>;

/** Conditional logic: visibility and dynamic required. */
export interface BitFieldConditional<T extends object = any> {
  dependsOn?: string[];
  showIf?: (values: T) => boolean;
  requiredIf?: (values: T) => boolean;
}

/** Field-level validation: async and required message. */
export interface BitFieldValidation<T extends object = any> {
  /** Custom message when field is required but empty. Falls back to defaultRequiredMessage or "Este campo é obrigatório". */
  requiredMessage?: string;
  asyncValidate?: (value: any, values: T) => Promise<string | null | undefined>;
  asyncValidateDelay?: number;
}

/** Full field definition: conditional, validation, transform, computed, mask, scope. */
export interface BitFieldDefinition<T extends object = any> {
  conditional?: BitFieldConditional<T>;
  validation?: BitFieldValidation<T>;
  transform?: BitTransformFn<T>;
  computed?: BitComputedFn<T>;
  /** Mask name (from registry) or BitMask instance. */
  mask?: BitMask | string;
  /** Scope name (e.g. wizard step). */
  scope?: string;
}

/** @deprecated Use BitFieldDefinition */
export type BitFieldConfig<T extends object = any> = BitFieldDefinition<T>;

export interface DevToolsOptions {
  enabled?: boolean;
  mode?: "local" | "remote";
  url?: string;
}

/** Validation config. */
export interface BitValidationConfig<T> {
  resolver?: ValidatorFn<T>;
  delay?: number;
  defaultRequiredMessage?: string;
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
  initialValues?: T;

  /** Central field config: conditional, validation, transform, computed, mask, scope. */
  fields?: Record<string, BitFieldDefinition<T>>;

  /** Schema-level validation */
  validation?: BitValidationConfig<T>;

  /** History (undo/redo) */
  history?: BitHistoryConfig;

  /** DevTools */
  devTools?: boolean | DevToolsOptions;
}

/** Internal config produced by normalizeConfig from BitConfig. */
export interface BitResolvedConfig<T extends object> {
  name?: string;
  initialValues: T;
  resolver?: ValidatorFn<T>;
  validationDelay: number;
  defaultRequiredMessage?: string;
  enableHistory: boolean;
  historyLimit: number;
  /** Derived from fields where field.computed exists. */
  computed?: Record<string, BitComputedFn<T>>;
  /** Derived from fields where field.transform exists. */
  transform?: Partial<Record<string, BitTransformFn<T>>>;
  /** Derived from fields where field.scope exists. */
  scopes?: Record<string, string[]>;
  masks?: Record<string, BitMask>;
  fields?: Record<string, BitFieldDefinition<T>>;
  devTools?: boolean | DevToolsOptions;
}

export interface BitFieldOptions {
  mask?: BitMask | string;
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

export interface BitLifecycleAdapter<T extends object> {
  getState: () => BitState<T>;
  internalUpdateState: (partial: Partial<BitState<T>>) => void;
  internalSaveSnapshot: () => void;
  config: BitResolvedConfig<T>;
  deps: BitDependencyManager<T>;
  validator: BitValidationManager<T>;
  history: BitHistoryManager<T>;
}

export interface BitStoreAdapter<T extends object = any> {
  getState: () => BitState<T>;
  getConfig(): BitResolvedConfig<T>;
  setField(path: string, value: any): void;
  internalUpdateState(partialState: any): void;
  internalSaveSnapshot(): void;
  unregisterPrefix?: (prefix: string) => void;
  validate?: () => Promise<boolean>;
}

export interface BitValidationAdapter<T extends object> {
  getState: () => BitState<T>;
  internalUpdateState: (partial: Partial<BitState<T>>) => void;
  setError: (path: string, message: string | undefined) => void;
  config: BitResolvedConfig<T>;
  deps: BitDependencyManager<T>;
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
            ? | `${K & (string | number)}`
              | `${K & (string | number)}.${BitPath<T[K]>}`
            : | `${Prefix}.${K & (string | number)}`
              | `${Prefix}.${K & (string | number)}.${BitPath<T[K]>}`;
      }[keyof T & (string | number)];

// Resolves the value type at a given dot-separated path.
export type BitPathValue<T, P extends string> =
  P extends `${infer K}.${infer Rest}`
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
export type BitArrayPath<T> = BitPath<T> extends infer P
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

