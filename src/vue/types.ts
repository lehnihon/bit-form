import type { ComputedRef, Ref } from "vue";
import type {
  BitErrors,
  BitHistoryMetadata,
  BitPersistMetadata,
  BitTouched,
  ScopeStatus,
  ValidateScopeResult,
} from "../core";

/**
 * Metadata describing the current state of a form field (Vue reactive).
 */
export interface UseBitFieldVueMeta {
  error: ComputedRef<string | undefined>;
  touched: ComputedRef<boolean>;
  invalid: ComputedRef<boolean>;
  isValidating: ComputedRef<boolean>;
  isDirty: ComputedRef<boolean>;
  isHidden: ComputedRef<boolean>;
  isRequired: ComputedRef<boolean>;
  hasError: ComputedRef<boolean>;
}

/**
 * Result from useBitField hook in Vue.
 * Provides field state, value, handlers, and metadata with Vue reactivity.
 */
export interface UseBitFieldVueResult<TValue = any> {
  // Main handlers and values (flat)
  value: ComputedRef<TValue>;
  displayValue: ComputedRef<string>;
  modelValue: ComputedRef<string>;
  setValue: (val: TValue | string | number | null | undefined) => void;
  setBlur: () => void;
  onInput: (val: TValue | string | number | null | undefined) => void;
  onBlur: () => void;
  // Metadata (grouped)
  meta: UseBitFieldVueMeta;
}

/**
 * Result from useBitSteps hook in Vue.
 * Provides multi-step form navigation and validation with Vue reactivity.
 */
export interface UseBitStepsResult {
  step: ComputedRef<number>;
  stepIndex: Ref<number>;
  scope: ComputedRef<string>;
  next: () => Promise<boolean>;
  prev: () => void;
  goTo: (step: number) => void;
  isFirst: ComputedRef<boolean>;
  isLast: ComputedRef<boolean>;
  status: Ref<ScopeStatus>;
  errors: ComputedRef<Record<string, string>>;
  isValid: ComputedRef<boolean>;
  isDirty: ComputedRef<boolean>;
  validate: () => Promise<ValidateScopeResult>;
  getErrors: () => Record<string, string>;
}

/**
 * Result from useBitUpload hook in Vue.
 * Provides file upload functionality with integrated validation (Vue reactive).
 */
export interface UseBitUploadResult {
  value: ComputedRef<string | File | null>;
  setValue: (value: string | File | null) => void;
  error: ComputedRef<string | undefined>;
  isValidating: ComputedRef<boolean>;
  upload: (file: File | null | undefined) => Promise<void>;
  remove: () => Promise<void>;
}

/**
 * Result from useBitHistory hook in Vue.
 * Provides form history undo/redo capabilities (Vue reactive).
 */
export interface UseBitHistoryResult {
  canUndo: ComputedRef<BitHistoryMetadata["canUndo"]>;
  canRedo: ComputedRef<BitHistoryMetadata["canRedo"]>;
  historyIndex: ComputedRef<BitHistoryMetadata["historyIndex"]>;
  historySize: ComputedRef<BitHistoryMetadata["historySize"]>;
  undo: () => void;
  redo: () => void;
}

export interface UseBitPersistResult {
  restore: () => Promise<boolean>;
  save: () => Promise<void>;
  clear: () => Promise<void>;
  meta: {
    isSaving: Ref<BitPersistMetadata["isSaving"]>;
    isRestoring: Ref<BitPersistMetadata["isRestoring"]>;
    error: Ref<BitPersistMetadata["error"]>;
  };
}

export interface UseBitFormResult<T extends object = any> {
  meta: {
    isValid: ComputedRef<boolean>;
    isDirty: ComputedRef<boolean>;
    isSubmitting: ComputedRef<boolean>;
    submitError: Ref<Error | null>;
    lastResponse: Ref<unknown>;
  };
  getValues: () => T;
  getErrors: () => BitErrors<T>;
  getTouched: () => BitTouched<T>;
  getDirtyValues: () => Partial<T>;
  submit: (
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ) => (e?: Event) => Promise<void>;
  onSubmit: (
    handler: (values: T, dirtyValues?: Partial<T>) => Promise<unknown>,
  ) => (e?: Event) => Promise<void>;
  reset: () => void;
  replaceValues: (values: T) => void;
  hydrate: (values: import("../core").DeepPartial<T>) => void;
  rebase: (values: T) => void;
  setError: (path: string, message: string | undefined) => void;
  setErrors: (errors: BitErrors<T>) => void;
  setServerErrors: (serverErrors: Record<string, string[] | string>) => void;
  setField: <P extends import("../core").BitPath<T>>(
    path: P,
    value: import("../core").BitPathValue<T, P>,
  ) => void;
  blurField: <P extends import("../core").BitPath<T>>(path: P) => void;
  validate: (
    options?: import("../core").BitValidationOptions,
  ) => Promise<boolean>;
}
