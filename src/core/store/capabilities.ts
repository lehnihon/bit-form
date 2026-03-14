import type { BitArrayManager } from "./array-manager";
import type { BitErrorManager } from "./error-manager";
import type { BitFieldQueryManager } from "./field-query-manager";
import type { BitHistoryManager } from "./history-manager";
import type { BitLifecycleManager } from "./lifecycle-manager";
import type { BitScopeManager } from "./scope-manager";
import type { BitValidationManager } from "./validation-manager";

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
