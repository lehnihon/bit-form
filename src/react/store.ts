import type { BitFrameworkStoreApi, BitStoreApi } from "../core";
import { createFrameworkStoreAdapter } from "../core";

export function resolveReactStore<T extends object>(
  store: BitFrameworkStoreApi<T> | BitStoreApi<T>,
): BitFrameworkStoreApi<T> {
  return createFrameworkStoreAdapter<T>(store);
}
