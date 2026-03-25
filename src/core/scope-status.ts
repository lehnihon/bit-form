import type { ScopeStatus } from "./store/contracts/types";
import {
  areScopeErrorsEqual as areSharedScopeErrorsEqual,
  getScopeSubscriptionPaths as getSharedScopeSubscriptionPaths,
  isScopeStatusEqual as isSharedScopeStatusEqual,
} from "./store/shared/scope-status";

export function areScopeErrorsEqual(
  currentErrors: Record<string, string>,
  nextErrors: Record<string, string>,
): boolean {
  return areSharedScopeErrorsEqual(currentErrors, nextErrors);
}

export function isScopeStatusEqual(
  currentStatus: ScopeStatus,
  nextStatus: ScopeStatus,
): boolean {
  return isSharedScopeStatusEqual(currentStatus, nextStatus);
}

export function getScopeSubscriptionPaths(scopeFields: readonly string[]) {
  return getSharedScopeSubscriptionPaths(scopeFields);
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
