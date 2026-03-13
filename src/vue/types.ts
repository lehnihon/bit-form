import type { ComputedRef, Ref } from "vue";
import type {
  BitHistoryMetadata,
  BitPersistMetadata,
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
