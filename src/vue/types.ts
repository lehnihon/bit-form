import type { ComputedRef, Ref } from "vue";
import type {
  BitErrors,
  BitHistoryAdapterResult,
  BitHistoryMetadata,
  BitPersistAdapterResult,
  BitStepsAdapterResult,
  BitTouched,
  BitUploadAdapterResult,
  ScopeStatus,
  ValidateScopeResult,
} from "../core";

/**
 * Metadata describing the current state of a form field (Vue reactive).
 * Values are unwrapped — reactive() desempacota nested Ref/ComputedRef.
 */
export interface UseBitFieldVueMeta {
  error: string | undefined;
  touched: boolean;
  invalid: boolean;
  isValidating: boolean;
  isDirty: boolean;
  isHidden: boolean;
  isRequired: boolean;
  hasError: boolean;
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
export type UseBitStepsResult = BitStepsAdapterResult<
  ComputedRef<number>,
  Ref<number>,
  ComputedRef<string>,
  ComputedRef<boolean>,
  Ref<ScopeStatus>,
  ComputedRef<Record<string, string>>,
  ValidateScopeResult
>;

/**
 * Result from useBitUpload hook in Vue.
 * Provides file upload functionality with integrated validation (Vue reactive).
 */
export type UseBitUploadResult = BitUploadAdapterResult<
  ComputedRef<string | File | null>,
  ComputedRef<string | undefined>,
  ComputedRef<boolean>
>;

/**
 * Result from useBitHistory hook in Vue.
 * Provides form history undo/redo capabilities (Vue reactive).
 */
export type UseBitHistoryResult = BitHistoryAdapterResult<
  ComputedRef<BitHistoryMetadata["canUndo"]>,
  ComputedRef<BitHistoryMetadata["canRedo"]>,
  ComputedRef<BitHistoryMetadata["historyIndex"]>,
  ComputedRef<BitHistoryMetadata["historySize"]>
>;

export type UseBitPersistResult = BitPersistAdapterResult<{
  isSaving: boolean;
  isRestoring: boolean;
  error: Error | null;
}>;

export interface UseBitFormResult<T extends object = any> {
  meta: {
    isValid: boolean;
    isDirty: boolean;
    isSubmitting: boolean;
    submitError: Error | null;
    lastResponse: unknown;
  };
  getValues: () => T;
  getErrors: () => BitErrors<T>;
  getTouched: () => BitTouched<T>;
  getDirtyValues: () => Partial<T>;
  submit: (
    onSuccess: (
      values: T,
      dirtyValues?: Partial<T>,
    ) => unknown | Promise<unknown>,
  ) => (e?: Event) => Promise<void>;
  onSubmit: (
    handler: (values: T, dirtyValues?: Partial<T>) => Promise<unknown>,
  ) => (e?: Event) => Promise<void>;
  reset: () => void;
  transaction: <TResult>(callback: () => TResult) => TResult;
  setValues: (
    values: T | import("../core").DeepPartial<T>,
    options?: { partial?: boolean; rebase?: boolean },
  ) => void;
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
