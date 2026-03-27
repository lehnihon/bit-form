import type { ScopeStatus } from "./store/contracts/types";
export {
  areScopeErrorsEqual,
  isScopeStatusEqual,
  getScopeSubscriptionPaths,
} from "./store/shared/scope-status";

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
