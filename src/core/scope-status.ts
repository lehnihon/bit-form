import type { ScopeStatus } from "./store/contracts/types";
export {
  areScopeErrorsEqual,
  isScopeStatusEqual,
  getScopeSubscriptionPaths,
} from "./store/shared/scope-status";

export function observeScopeStatusSnapshot(
  store: {
    read: {
      getScopeStatus(scopeName: string): ScopeStatus;
    };
    observe: {
      subscribeScopeStatus(
        scopeName: string,
        listener: (status: ScopeStatus) => void,
      ): () => void;
    };
  },
  scopeName: string,
  listener: (status: ScopeStatus) => void,
): () => void {
  listener(store.read.getScopeStatus(scopeName));

  return store.observe.subscribeScopeStatus(scopeName, listener);
}
