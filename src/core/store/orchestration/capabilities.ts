import type { BitArrayManager } from "../managers/features/array-manager";
import type { BitErrorManager } from "../managers/features/error-manager";
import type { BitFieldQueryManager } from "../managers/features/field-query-manager";
import type { BitHistoryManager } from "../managers/features/history-manager";
import type { BitLifecycleManager } from "../managers/features/lifecycle-manager";
import type { BitScopeManager } from "../managers/features/scope-manager";
import type { BitValidationManager } from "../managers/features/validation-manager";

export interface BitStoreCapabilities<T extends object> extends Record<
  string,
  unknown
> {
  validation: BitValidationManager<T>;
  lifecycle: BitLifecycleManager<T>;
  history: BitHistoryManager<T>;
  arrays: BitArrayManager<T>;
  scope: BitScopeManager<T>;
  query: BitFieldQueryManager<T>;
  error: BitErrorManager<T>;
}
