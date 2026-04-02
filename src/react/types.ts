import type {
  BitErrors,
  BitFieldInputEvent,
  BitHistoryAdapterResult,
  BitHistoryMetadata,
  BitPath,
  BitPathValue,
  BitPersistAdapterResult,
  BitPersistMetadata,
  BitStepsAdapterResult,
  BitTouched,
  BitUploadAdapterResult,
  ScopeStatus,
  ValidateScopeResult,
} from "../core";
export type { BitFieldInputEvent };

/**
 * Metadata describing the current state of a form field.
 */
export interface UseBitFieldMeta {
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
 * Props that can be spread onto a native HTML input element.
 */
export interface UseBitFieldBindProps {
  value: string;
  onChange: (e: BitFieldInputEvent) => void;
  onBlur: () => void;
}

/**
 * Result from useBitField hook.
 * Provides field state, value, handlers, and metadata.
 */
export interface UseBitFieldResult<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
> {
  // Main handlers and values (flat)
  value: BitPathValue<TForm, P>;
  displayValue: string;
  setValue: (
    val: BitPathValue<TForm, P> | string | number | null | undefined,
  ) => void;
  setBlur: () => void;
  onChange: (e: BitFieldInputEvent) => void;
  onBlur: () => void;
  // Props helper for native inputs
  props: UseBitFieldBindProps;
  // Readonly metadata (grouped)
  meta: UseBitFieldMeta;
}

/**
 * Result from useBitSteps hook.
 * Provides multi-step form navigation and validation.
 */
export type UseBitStepsResult = BitStepsAdapterResult<
  number,
  number,
  string,
  boolean,
  ScopeStatus,
  Record<string, string>,
  ValidateScopeResult
>;

/**
 * Result from useBitUpload hook.
 * Provides file upload functionality with integrated validation.
 */
export type UseBitUploadResult = BitUploadAdapterResult<
  string | File | null,
  string | undefined,
  boolean
>;

/**
 * Result from useBitHistory hook.
 * Provides form history undo/redo capabilities.
 */
export type UseBitHistoryResult = BitHistoryAdapterResult<
  BitHistoryMetadata["canUndo"],
  BitHistoryMetadata["canRedo"],
  BitHistoryMetadata["historyIndex"],
  BitHistoryMetadata["historySize"]
>;

export type UseBitPersistResult = BitPersistAdapterResult<BitPersistMetadata>;

export interface UseBitFormMeta {
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
  submitError: Error | null;
  lastResponse: unknown;
}

export interface UseBitFormResult<T extends object = any> {
  meta: UseBitFormMeta;
  getValues: () => T;
  getErrors: () => BitErrors<T>;
  getTouched: () => BitTouched<T>;
  getDirtyValues: () => Partial<T>;
  submit: (
    onSuccess: (
      values: T,
      dirtyValues?: Partial<T>,
    ) => unknown | Promise<unknown>,
  ) => (e?: { preventDefault: () => void }) => Promise<void>;
  onSubmit: (
    handler: (values: T, dirtyValues?: Partial<T>) => Promise<unknown>,
  ) => (e?: { preventDefault: () => void }) => Promise<void>;
  reset: () => void;
  transaction: <TResult>(callback: () => TResult) => TResult;
  setField: <P extends BitPath<T>>(path: P, value: BitPathValue<T, P>) => void;
  blurField: <P extends BitPath<T>>(path: P) => void;
  setValues: (
    values: T | import("../core").DeepPartial<T>,
    options?: { partial?: boolean; rebase?: boolean },
  ) => void;
  setError: (path: string, message: string | undefined) => void;
  setErrors: (errors: BitErrors<T>) => void;
  setServerErrors: (serverErrors: Record<string, string[] | string>) => void;
  validate: (
    options?: import("../core").BitValidationOptions,
  ) => Promise<boolean>;
}
