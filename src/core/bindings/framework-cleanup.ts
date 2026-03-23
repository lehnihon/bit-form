type FieldCleanupStore = {
  unregisterField?: (path: string) => void;
};

type PrefixCleanupStore = {
  unregisterPrefix?: (prefix: string) => void;
};

export function cleanupRegisteredField(
  store: FieldCleanupStore,
  path: string,
): void {
  store.unregisterField?.(path);
}

export function cleanupRegisteredPrefix(
  store: PrefixCleanupStore,
  prefix: string,
): void {
  store.unregisterPrefix?.(prefix);
}
