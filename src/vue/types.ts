import type { ComputedRef, Ref } from "vue";
import type { ScopeStatus, ValidateScopeResult } from "../core";

/**
 * Metadata describing the current state of a form field (Vue reactive).
 */
export interface UseBitFieldVueMeta {
  error: Readonly<any>;
  touched: Readonly<any>;
  invalid: Readonly<any>;
  isValidating: Readonly<any>;
  isDirty: Readonly<any>;
  isHidden: Readonly<any>;
  isRequired: Readonly<any>;
  hasError: Readonly<any>;
}

/**
 * Result from useBitField hook in Vue.
 * Provides field state, value, handlers, and metadata with Vue reactivity.
 */
export interface UseBitFieldVueResult<TValue = any> {
  // Main handlers and values (flat)
  value: Readonly<any>;
  displayValue: Readonly<any>;
  modelValue: any;
  setValue: (val: any) => void;
  setBlur: () => void;
  onInput: (val: any) => void;
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
  canUndo: Readonly<any>;
  canRedo: Readonly<any>;
  historyIndex: Readonly<any>;
  historySize: Readonly<any>;
  undo: () => void;
  redo: () => void;
}

export interface UseBitPersistResult {
  restore: () => Promise<boolean>;
  save: () => Promise<void>;
  clear: () => Promise<void>;
  meta: {
    isSaving: Ref<boolean>;
    isRestoring: Ref<boolean>;
    error: Ref<Error | null>;
  };
}
