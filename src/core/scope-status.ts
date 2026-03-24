import type { ScopeStatus } from "./store/contracts/types";

export function areScopeErrorsEqual(
  currentErrors: Record<string, string>,
  nextErrors: Record<string, string>,
): boolean {
  const currentKeys = Object.keys(currentErrors);
  const nextKeys = Object.keys(nextErrors);

  if (currentKeys.length !== nextKeys.length) {
    return false;
  }

  return currentKeys.every((key) => currentErrors[key] === nextErrors[key]);
}

export function isScopeStatusEqual(
  currentStatus: ScopeStatus,
  nextStatus: ScopeStatus,
): boolean {
  return (
    currentStatus.hasErrors === nextStatus.hasErrors &&
    currentStatus.isDirty === nextStatus.isDirty &&
    areScopeErrorsEqual(currentStatus.errors, nextStatus.errors)
  );
}

export function getScopeSubscriptionPaths(scopeFields: readonly string[]) {
  return [...scopeFields, "isDirty"];
}

export function getScopeRegistrySubscriptionPath(scopeName: string) {
  return `__scope__.${scopeName}`;
}

export function observeScopeStatusSnapshot(
  store: {
    getScopeStatus(scopeName: string): ScopeStatus;
    subscribeScopeStatus(
      scopeName: string,
      listener: (status: ScopeStatus) => void,
    ): () => void;
  },
  scopeName: string,
  listener: (status: ScopeStatus) => void,
): () => void {
  listener(store.getScopeStatus(scopeName));

  return store.subscribeScopeStatus(scopeName, listener);
}
