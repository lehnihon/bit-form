import type {
  BitErrors,
  BitHistoryMetadata,
  BitPath,
  BitPathValue,
  BitPersistMetadata,
  BitTouched,
} from "../core";
import type { BitFieldInputEvent } from "../core/mask/field-binding";
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
export interface UseBitStepsResult {
  step: number;
  stepIndex: number;
  scope: string;
  next: () => Promise<boolean>;
  prev: () => void;
  goTo: (step: number) => void;
  isFirst: boolean;
  isLast: boolean;
  status: import("../core").ScopeStatus;
  errors: Record<string, string>;
  isValid: boolean;
  isDirty: boolean;
  validate: () => Promise<import("../core").ValidateScopeResult>;
  getErrors: () => Record<string, string>;
}

/**
 * Result from useBitUpload hook.
 * Provides file upload functionality with integrated validation.
 */
export interface UseBitUploadResult {
  value: string | File | null;
  setValue: (value: string | File | null) => void;
  error?: string;
  isValidating: boolean;
  upload: (file: File | null | undefined) => Promise<void>;
  remove: () => Promise<void>;
}

/**
 * Result from useBitHistory hook.
 * Provides form history undo/redo capabilities.
 */
export interface UseBitHistoryResult {
  canUndo: BitHistoryMetadata["canUndo"];
  canRedo: BitHistoryMetadata["canRedo"];
  historyIndex: BitHistoryMetadata["historyIndex"];
  historySize: BitHistoryMetadata["historySize"];
  undo: () => void;
  redo: () => void;
}

export interface UseBitPersistResult {
  restore: () => Promise<boolean>;
  save: () => Promise<void>;
  clear: () => Promise<void>;
  meta: BitPersistMetadata;
}

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
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ) => (e?: { preventDefault: () => void }) => Promise<void>;
  onSubmit: (
    handler: (values: T, dirtyValues?: Partial<T>) => Promise<unknown>,
  ) => (e?: { preventDefault: () => void }) => Promise<void>;
  reset: () => void;
  setField: <P extends BitPath<T>>(path: P, value: BitPathValue<T, P>) => void;
  blurField: <P extends BitPath<T>>(path: P) => void;
  replaceValues: (values: T) => void;
  hydrate: (values: import("../core").DeepPartial<T>) => void;
  rebase: (values: T) => void;
  setError: (path: string, message: string | undefined) => void;
  setErrors: (errors: BitErrors<T>) => void;
  setServerErrors: (serverErrors: Record<string, string[] | string>) => void;
  validate: (
    options?: import("../core").BitValidationOptions,
  ) => Promise<boolean>;
}
