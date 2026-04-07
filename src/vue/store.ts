import type { BitFrameworkStoreApi, BitStoreApi } from "../core";
import { createFrameworkStoreAdapter } from "../core";

export function resolveVueStore<T extends object>(
  store: BitFrameworkStoreApi<T> | BitStoreApi<T>,
): BitFrameworkStoreApi<T> {
  return createFrameworkStoreAdapter<T>(store);
}
