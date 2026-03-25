import type { ScopeStatus } from "./store/contracts/types";
import {
  areStepErrorsEqual,
  getStepSubscriptionPaths,
  isStepStatusEqual,
} from "./store/shared/step-status";

export function areScopeErrorsEqual(
  currentErrors: Record<string, string>,
  nextErrors: Record<string, string>,
): boolean {
  return areStepErrorsEqual(currentErrors, nextErrors);
}

export function isScopeStatusEqual(
  currentStatus: ScopeStatus,
  nextStatus: ScopeStatus,
): boolean {
  return isStepStatusEqual(currentStatus, nextStatus);
}

export function getScopeSubscriptionPaths(scopeFields: readonly string[]) {
  return getStepSubscriptionPaths(scopeFields);
}

export function observeScopeStatusSnapshot(
  store: {
    getStepStatus(scopeName: string): ScopeStatus;
    subscribeScopeStatus(
      scopeName: string,
      listener: (status: ScopeStatus) => void,
    ): () => void;
  },
  scopeName: string,
  listener: (status: ScopeStatus) => void,
): () => void {
  listener(store.getStepStatus(scopeName));

  return store.subscribeScopeStatus(scopeName, listener);
}
