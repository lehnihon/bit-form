import type { Signal } from "@angular/core";
import type {
  BitErrors,
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

// BitFieldInputEvent é definido no core e re-exportado aqui
// para evitar duplicação com a definição equivalente em react/types.ts
import type { BitFieldInputEvent } from "../core";
export type { BitFieldInputEvent };

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
  onBlur: () => void;
  // Readonly metadata (grouped)
  meta: InjectBitFieldMeta;
}

/**
 * Result from injectBitSteps in Angular.
 * Provides multi-step form navigation and validation using Angular Signals.
 */
export type InjectBitStepsResult = BitStepsAdapterResult<
  ReturnType<typeof import("@angular/core").computed<number>>,
  ReturnType<typeof import("@angular/core").signal<number>>,
  ReturnType<typeof import("@angular/core").computed<string>>,
  ReturnType<typeof import("@angular/core").computed<boolean>>,
  ReturnType<typeof import("@angular/core").signal<ScopeStatus>>,
  ReturnType<typeof import("@angular/core").computed<Record<string, string>>>,
  ValidateScopeResult
>;

/**
 * Result from injectBitUpload in Angular.
 * Provides file upload functionality with integrated validation (Angular Signal).
 */
export type InjectBitUploadResult = BitUploadAdapterResult<
  Signal<string | File | null>,
  Signal<string | undefined>,
  Signal<boolean>
>;

/**
 * Result from injectBitHistory in Angular.
 * Provides form history undo/redo capabilities (Angular Signals).
 */
export type InjectBitHistoryResult = BitHistoryAdapterResult<
  ReturnType<typeof import("@angular/core").computed<boolean>>,
  ReturnType<typeof import("@angular/core").computed<boolean>>,
  ReturnType<
    typeof import("@angular/core").computed<BitHistoryMetadata["historyIndex"]>
  >,
  ReturnType<
    typeof import("@angular/core").computed<BitHistoryMetadata["historySize"]>
  >
>;

export type InjectBitPersistResult = BitPersistAdapterResult<{
  isSaving: Signal<BitPersistMetadata["isSaving"]>;
  isRestoring: Signal<BitPersistMetadata["isRestoring"]>;
  error: Signal<BitPersistMetadata["error"]>;
}>;

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
    onSuccess: (
      values: T,
      dirtyValues?: Partial<T>,
    ) => unknown | Promise<unknown>,
  ) => (event?: Event) => Promise<void>;
  onSubmit: (
    handler: (values: T, dirtyValues?: Partial<T>) => Promise<unknown>,
  ) => (event?: Event) => Promise<void>;
  reset: () => void;
  transaction: <TResult>(callback: () => TResult) => TResult;
  setValues: (
    values: T | import("../core").DeepPartial<T>,
    options?: { partial?: boolean; rebase?: boolean },
  ) => void;
  setError: (path: string, message: string | undefined) => void;
  setErrors: (errors: BitErrors<T>) => void;
  setServerErrors: (serverErrors: Record<string, string[] | string>) => void;
  setField: <P extends BitPath<T>>(path: P, value: BitPathValue<T, P>) => void;
  blurField: <P extends BitPath<T>>(path: P) => void;
  validate: (
    options?: import("../core").BitValidationOptions,
  ) => Promise<boolean>;
}
