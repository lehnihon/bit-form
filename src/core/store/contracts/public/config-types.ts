import type { BitFormGlobal } from "../bus-types";
import type { BitFieldDefinition, ValidatorFn } from "./field-types";
import type { BitPersistConfig } from "./persist-types";
import type { BitPlugin } from "./plugin-core-types";
import type { BitOperationalErrorSource } from "./plugin-event-types";
import type {
  BitIdFactory,
  BitScheduler,
  DevToolsOptions,
} from "./runtime-types";

/** Validation config. */
export interface BitValidationConfig<T extends object> {
  resolver?: ValidatorFn<T>;
  delay?: number;
}

/** History config. */
export interface BitHistoryConfig {
  enabled?: boolean;
  /**
   * Maximum number of undo/redo steps to retain.
   * @default 50
   */
  limit?: number;
}

/**
 * BitConfig - store configuration.
 * @see CHANGELOG for migration from features to fields in 2.0.
 */
export interface BitConfig<T extends object = Record<string, unknown>> {
  /** Core */
  name?: string;
  storeId?: string;
  idFactory?: BitIdFactory;
  initialValues?: T;

  /** Central field config: conditional, validation, transform, computed, mask, scope. */
  fields?: Record<string, BitFieldDefinition<T>>;

  /** Schema-level validation */
  validation?: BitValidationConfig<T>;

  /** History (undo/redo) */
  history?: BitHistoryConfig;

  /** DevTools */
  devTools?: boolean | DevToolsOptions;

  /** Persistência local de rascunho */
  persist?: BitPersistConfig<T>;

  /** Plugins de lifecycle (observabilidade) */
  plugins?: BitPlugin<T>[];

  /**
   * Maximum number of entries for internal subscription path caches.
   * Lower = less memory; higher = fewer cache evictions in large dynamic forms.
   * @default 500
   */
  subscriptionCacheSize?: number;

  /**
   * Pluggable scheduler for validation debounce.
   * Defaults to a setTimeout-based scheduler.
   */
  scheduler?: BitScheduler;

  /**
   * Custom bus instance for DevTools/observability.
   */
  bus?: BitFormGlobal;

  /**
   * Enables advanced tracked selector subscriptions (mode: tracked).
   */
  trackedSubscriptions?: boolean;

  /**
   * Handler opcional para erros operacionais não tratados internamente.
   */
  onUnhandledError?: (
    error: unknown,
    source: BitOperationalErrorSource,
  ) => void;
}
