/**
 * Pluggable scheduler used for validation debounce.
 * Replace the default (setTimeout-based) with a framework-aware scheduler.
 */
export interface BitScheduler {
  schedule(fn: () => void, delayMs: number): () => void;
}

export interface BitIdFactoryContext {
  scope: "store" | "array";
  path?: string;
  index?: number;
  storeName?: string;
}

export type BitIdFactory = (context: BitIdFactoryContext) => string;

export type BitSubmitResult =
  | { status: "submitted" }
  | { status: "invalid" }
  | { status: "failed"; error: unknown }
  | { status: "blocked"; reason: "isSubmitting" | "validating" };

/** Return type of BitStore.getScopeStatus, used by useBitScope/injectBitScope. */
export interface ScopeStatus {
  hasErrors: boolean;
  isDirty: boolean;
  errors: Record<string, string>;
}

/** Return type of scope validation helpers, used by useBitScope/injectBitScope. */
export interface ValidateScopeResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface DevToolsOptions {
  enabled?: boolean;
  mode?: "local" | "remote";
  url?: string;
}
