import type {
  BitPath,
  BitPathValue,
  BitPersistMetadata,
  ScopeStatus,
} from "../contracts/types";
import type {
  BitFormMeta,
  BitHistoryMetadata,
} from "../contracts/public/meta-types";
import type {
  BitSelector,
  BitSelectorSubscriptionOptions,
} from "../contracts/public/subscription-types";
import type { BitFieldState } from "../contracts/types";
import {
  subscribeStoreFieldState,
  subscribeStoreFormMeta,
  subscribeStoreHistoryMeta,
  subscribeStorePath,
  subscribeStorePersistMeta,
  subscribeStoreScopeStatus,
  subscribeStoreSelector,
  subscribeStoreTracked,
} from "../orchestration/store-observe-ops";
import type { BitFieldRegistry } from "../registry/field-registry";
import type { BitStoreRuntimeKernel } from "../orchestration/store-runtime-kernel";

export class BitStoreObserveFacade<T extends object> {
  constructor(
    private readonly runtime: BitStoreRuntimeKernel<T>,
    private readonly fieldRegistry: BitFieldRegistry<T>,
    private readonly getFieldStateFn: <P extends BitPath<T>>(
      path: P,
    ) => BitFieldState<T, BitPathValue<T, P>>,
    private readonly getScopeStatusFn: (scopeName: string) => ScopeStatus,
    private readonly getScopeFieldsFn: (scopeName: string) => string[],
    private readonly getHistoryMetadataFn: () => BitHistoryMetadata,
  ) {}

  subscribe(listener: () => void): () => void {
    return this.runtime.subscriptions.subscribe(listener);
  }

  subscribeSelector<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options?: BitSelectorSubscriptionOptions<TSlice>,
  ): () => void {
    return subscribeStoreSelector({
      subscriptions: this.runtime.subscriptions,
      selector,
      listener,
      options,
    });
  }

  subscribePersistMeta(
    listener: (meta: BitPersistMetadata) => void,
  ): () => void {
    return subscribeStorePersistMeta({
      listener,
      subscribeSelector: (selector, persistListener, options) =>
        this.subscribeSelector(selector, persistListener, options),
    });
  }

  subscribeHistoryMeta(
    listener: (meta: BitHistoryMetadata) => void,
  ): () => void {
    return subscribeStoreHistoryMeta({
      readHistoryMeta: () => this.getHistoryMetadataFn(),
      subscribe: (metaListener) => this.subscribe(metaListener),
      listener,
    });
  }

  subscribeScopeStatus(
    scopeName: string,
    listener: (status: ScopeStatus) => void,
  ): () => void {
    return subscribeStoreScopeStatus({
      scopeName,
      readScopeStatus: (targetScopeName) =>
        this.getScopeStatusFn(targetScopeName),
      getScopeFields: (targetScopeName) =>
        this.getScopeFieldsFn(targetScopeName),
      subscribeSelector: (selector, statusListener, options) =>
        this.subscribeSelector(selector, statusListener, options),
      listener,
    });
  }

  subscribeTracked<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options?: Omit<BitSelectorSubscriptionOptions<TSlice>, "paths">,
  ): () => void {
    return subscribeStoreTracked({
      getState: () => this.runtime.getState(),
      subscribeSelector: (trackedSelector, trackedListener, trackedOptions) =>
        this.subscribeSelector(
          trackedSelector,
          trackedListener,
          trackedOptions,
        ),
      selector,
      listener,
      options,
    });
  }

  subscribePath<P extends BitPath<T>>(
    path: P,
    listener: (value: BitPathValue<T, P>) => void,
    options?: BitSelectorSubscriptionOptions<BitPathValue<T, P>>,
  ): () => void {
    return subscribeStorePath({
      path,
      listener,
      options,
      subscribeSelector: (selector, pathListener, pathOptions) =>
        this.subscribeSelector(selector, pathListener, pathOptions),
    });
  }

  subscribeFieldState<P extends BitPath<T>>(
    path: P,
    listener: (state: Readonly<BitFieldState<T, BitPathValue<T, P>>>) => void,
  ): () => void {
    return subscribeStoreFieldState({
      path,
      listener,
      getFieldState: (fieldPath) => this.getFieldStateFn(fieldPath),
      subscribeSelector: (selector, fieldStateListener, fieldStateOptions) =>
        this.subscribeSelector(selector, fieldStateListener, fieldStateOptions),
    });
  }

  subscribeFormMeta(listener: (meta: BitFormMeta) => void): () => void {
    return subscribeStoreFormMeta({
      listener,
      subscribeSelector: (selector, metaListener, metaOptions) =>
        this.subscribeSelector(selector, metaListener, metaOptions),
    });
  }
}
