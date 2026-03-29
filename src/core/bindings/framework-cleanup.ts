type FieldCleanupStore = {
  feature?: {
    unregisterField?: (path: string) => void;
  };
};

type PrefixCleanupStore = {
  feature?: {
    unregisterPrefix?: (prefix: string) => void;
  };
};

export function cleanupRegisteredField(
  store: FieldCleanupStore,
  path: string,
): void {
  store.feature?.unregisterField?.(path);
}

export function cleanupRegisteredPrefix(
  store: PrefixCleanupStore,
  prefix: string,
): void {
  store.feature?.unregisterPrefix?.(prefix);
}
