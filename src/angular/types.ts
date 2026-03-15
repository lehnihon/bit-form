import type { Signal } from "@angular/core";
import type {
  BitErrors,
  BitHistoryMetadata,
  BitPersistMetadata,
  BitPath,
  BitPathValue,
  BitTouched,
  ScopeStatus,
  ValidateScopeResult,
} from "../core";

/**
 * Metadata describing the current state of a form field (Angular Signal).
 */
export interface InjectBitFieldMeta {
  error: () => string | undefined;
  touched: () => boolean;
  invalid: () => boolean;
  isDirty: () => boolean;
  isValidating: () => boolean;
  isHidden: () => boolean;
  isRequired: () => boolean;
  hasError: () => boolean;
}

/**
 * Result from injectBitField in Angular.
 * Provides field state, value, handlers, and metadata using Angular Signals.
 */
/**
 * Accepted input for Angular field update handlers.
 * Covers native events (`e.target.value`), synthetic events, and direct values.
 */
export type BitFieldInputEvent =
  | { target?: { value?: string | number | null } }
  | string
  | number
  | null
  | undefined;

export interface InjectBitFieldResult<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
> {
  // Main handlers and values (flat)
  value: () => BitPathValue<TForm, P>;
  displayValue: () => string;
  setValue: (
    val: BitPathValue<TForm, P> | string | number | null | undefined,
  ) => void;
  setBlur: () => void;
  update: (e: BitFieldInputEvent) => void;
  // Readonly metadata (grouped)
  meta: InjectBitFieldMeta;
}

/**
 * Result from injectBitSteps in Angular.
 * Provides multi-step form navigation and validation using Angular Signals.
 */
export interface InjectBitStepsResult {
  step: ReturnType<typeof import("@angular/core").computed<number>>;
  stepIndex: ReturnType<typeof import("@angular/core").signal<number>>;
  scope: ReturnType<typeof import("@angular/core").computed<string>>;
  next: () => Promise<boolean>;
  prev: () => void;
  goTo: (step: number) => void;
  isFirst: ReturnType<typeof import("@angular/core").computed<boolean>>;
  isLast: ReturnType<typeof import("@angular/core").computed<boolean>>;
  status: ReturnType<typeof import("@angular/core").signal<ScopeStatus>>;
  errors: ReturnType<
    typeof import("@angular/core").computed<Record<string, string>>
  >;
  isValid: ReturnType<typeof import("@angular/core").computed<boolean>>;
  isDirty: ReturnType<typeof import("@angular/core").computed<boolean>>;
  validate: () => Promise<ValidateScopeResult>;
  getErrors: () => Record<string, string>;
}

/**
 * Result from injectBitUpload in Angular.
 * Provides file upload functionality with integrated validation (Angular Signal).
 */
export interface InjectBitUploadResult {
  value: Signal<string | File | null>;
  setValue: (value: string | File | null) => void;
  error: Signal<string | undefined>;
  isValidating: Signal<boolean>;
  upload: (file: File | null | undefined) => Promise<void>;
  remove: () => Promise<void>;
}

/**
 * Result from injectBitHistory in Angular.
 * Provides form history undo/redo capabilities (Angular Signals).
 */
export interface InjectBitHistoryResult {
  canUndo: ReturnType<typeof import("@angular/core").computed<boolean>>;
  canRedo: ReturnType<typeof import("@angular/core").computed<boolean>>;
  historyIndex: ReturnType<
    typeof import("@angular/core").computed<BitHistoryMetadata["historyIndex"]>
  >;
  historySize: ReturnType<
    typeof import("@angular/core").computed<BitHistoryMetadata["historySize"]>
  >;
  undo: () => void;
  redo: () => void;
}

export interface InjectBitPersistResult {
  restore: () => Promise<boolean>;
  save: () => Promise<void>;
  clear: () => Promise<void>;
  meta: {
    isSaving: Signal<BitPersistMetadata["isSaving"]>;
    isRestoring: Signal<BitPersistMetadata["isRestoring"]>;
    error: Signal<BitPersistMetadata["error"]>;
  };
}

export interface InjectBitFormResult<T extends object = any> {
  meta: {
    isValid: ReturnType<typeof import("@angular/core").computed<boolean>>;
    isDirty: ReturnType<typeof import("@angular/core").computed<boolean>>;
    isSubmitting: ReturnType<typeof import("@angular/core").computed<boolean>>;
    submitError: Signal<Error | null>;
    lastResponse: Signal<unknown>;
  };
  getValues: () => T;
  getErrors: () => BitErrors<T>;
  getTouched: () => BitTouched<T>;
  getDirtyValues: () => Partial<T>;
  submit: (
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ) => (event?: Event) => Promise<void>;
  onSubmit: (
    handler: (values: T, dirtyValues?: Partial<T>) => Promise<unknown>,
  ) => (event?: Event) => Promise<void>;
  reset: () => void;
  replaceValues: (values: T) => void;
  hydrate: (values: import("../core").DeepPartial<T>) => void;
  rebase: (values: T) => void;
  setError: (path: string, message: string | undefined) => void;
  setErrors: (errors: BitErrors<T>) => void;
  setServerErrors: (serverErrors: Record<string, string[] | string>) => void;
  setField: <P extends BitPath<T>>(path: P, value: BitPathValue<T, P>) => void;
  blurField: <P extends BitPath<T>>(path: P) => void;
  validate: (
    options?: import("../core").BitValidationOptions,
  ) => Promise<boolean>;
}
