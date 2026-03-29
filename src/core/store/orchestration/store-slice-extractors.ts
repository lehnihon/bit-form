import type {
  BitStoreApi,
  BitStoreReadSliceApi,
  BitStoreObserveSliceApi,
  BitStoreWriteSliceApi,
  BitStoreFeatureApi,
} from "../contracts/public/store-api-types";

/**
 * Extracts the `read` slice from a BitStore instance.
 *
 * Use this to pass a read-only API to utility functions and services.
 *
 * @example
 * ```typescript
 * function useFormValidation(read: BitStoreReadSliceApi<MyForm>) {
 *   const isValid = read.getIsValid();
 *   // ...
 * }
 *
 * useFormValidation(extractReadSlice(store));
 * ```
 */
export function extractReadSlice<T extends object>(
  store: BitStoreApi<T>,
): BitStoreReadSliceApi<T> {
  return store.read;
}

/**
 * Extracts the `observe` slice from a BitStore instance.
 *
 * Use this to pass an observation-only API to framework hooks and subscriptions.
 *
 * @example
 * ```typescript
 * function useFormSubscribe(observe: BitStoreObserveSliceApi<MyForm>) {
 *   useEffect(() => observe.subscribe(handler), [observe]);
 * }
 *
 * useFormSubscribe(extractObserveSlice(store));
 * ```
 */
export function extractObserveSlice<T extends object>(
  store: BitStoreApi<T>,
): BitStoreObserveSliceApi<T> {
  return store.observe;
}

/**
 * Extracts the `write` slice from a BitStore instance.
 *
 * Use this to pass a write-only API for form mutations.
 *
 * @example
 * ```typescript
 * function useFormActions(write: BitStoreWriteSliceApi<MyForm>) {
 *   const handleChange = (path: string, value: any) => {
 *     write.setField(path, value);
 *   };
 * }
 *
 * useFormActions(extractWriteSlice(store));
 * ```
 */
export function extractWriteSlice<T extends object>(
  store: BitStoreApi<T>,
): BitStoreWriteSliceApi<T> {
  return store.write;
}

/**
 * Extracts the `feature` slice from a BitStore instance.
 *
 * Use this to pass feature-specific APIs (validation, history, persistence, etc.)
 *
 * @example
 * ```typescript
 * function useFormValidation(feature: BitStoreFeatureApi<MyForm>) {
 *   const isValid = await feature.validate();
 * }
 *
 * useFormValidation(extractFeatureSlice(store));
 * ```
 */
export function extractFeatureSlice<T extends object>(
  store: BitStoreApi<T>,
): BitStoreFeatureApi<T> {
  return store.feature;
}

/**
 * Extracts multiple slices at once for convenience.
 *
 * @example
 * ```typescript
 * const [readApi, writeApi] = extractSlices(store, ["read", "write"]);
 * ```
 */
export function extractSlices<
  T extends object,
  K extends (keyof BitStoreApi<T>)[],
>(
  store: BitStoreApi<T>,
  keys: readonly [...K],
): {
  [P in K[number]]: BitStoreApi<T>[P];
} {
  const result: Partial<BitStoreApi<T>> = {};

  for (const key of keys) {
    result[key] = store[key];
  }

  return result as {
    [P in K[number]]: BitStoreApi<T>[P];
  };
}
