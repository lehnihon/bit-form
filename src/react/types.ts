import type { BitPath, BitPathValue } from "../core";

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
  onChange: (e: any) => void;
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
  setValue: (val: any) => void;
  setBlur: () => void;
  onChange: (e: any) => void;
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
  canUndo: boolean;
  canRedo: boolean;
  historyIndex: number;
  historySize: number;
  undo: () => void;
  redo: () => void;
}
