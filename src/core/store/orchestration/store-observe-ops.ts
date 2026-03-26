import { getDeepValue, valueEqual } from "../../utils";
import { createTrackedSubscription } from "./tracked-selector";
import type {
  BitSelector,
  BitSelectorSubscriptionOptions,
} from "../contracts/public/subscription-types";
import type {
  BitFormMeta,
  BitHistoryMetadata,
} from "../contracts/public/meta-types";
import type { BitFieldState, BitPath, BitPathValue } from "../contracts/types";
import type { BitState } from "../contracts/types";
import type { BitSubscriptionEngine } from "../engines/subscription-engine";
import type { BitPersistMetadata, ScopeStatus } from "../contracts/types";
import { isHistoryMetaEqual } from "../../history-status";
import {
  getScopeRegistrySubscriptionPath,
  getScopeSubscriptionPaths,
  isScopeStatusEqual,
} from "../shared/scope-status";
import { getHistorySubscriptionPath } from "../../history-status";

export function subscribeStoreSelector<T extends object, TSlice>(args: {
  subscriptions: Pick<BitSubscriptionEngine<T>, "subscribeSelector">;
  selector: BitSelector<T, TSlice>;
  listener: (slice: TSlice) => void;
  options?: BitSelectorSubscriptionOptions<TSlice>;
}): () => void {
  const { subscriptions, selector, listener, options } = args;
  const equalityFn = options?.equalityFn ?? valueEqual;

  return subscriptions.subscribeSelector(
    selector,
    listener,
    options,
    equalityFn,
  );
}

export function subscribeStoreTracked<T extends object, TSlice>(args: {
  getState: () => Readonly<BitState<T>>;
  subscribeSelector: (
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options?: BitSelectorSubscriptionOptions<TSlice>,
  ) => () => void;
  selector: BitSelector<T, TSlice>;
  listener: (slice: TSlice) => void;
  options?: Omit<BitSelectorSubscriptionOptions<TSlice>, "paths">;
}): () => void {
  const { getState, subscribeSelector, selector, listener, options } = args;

  return createTrackedSubscription({
    getState,
    subscribeSelector: (trackedSelector, trackedListener, trackedOptions) =>
      subscribeSelector(trackedSelector, trackedListener, trackedOptions),
    selector,
    listener,
    options,
  });
}

export function subscribeStorePath<
  T extends object,
  P extends BitPath<T>,
>(args: {
  path: P;
  listener: (value: BitPathValue<T, P>) => void;
  options?: BitSelectorSubscriptionOptions<BitPathValue<T, P>>;
  subscribeSelector: (
    selector: BitSelector<T, BitPathValue<T, P>>,
    listener: (slice: BitPathValue<T, P>) => void,
    options?: BitSelectorSubscriptionOptions<BitPathValue<T, P>>,
  ) => () => void;
}): () => void {
  const { path, listener, options, subscribeSelector } = args;
  const mergedPaths = [...(options?.paths ?? []), path as string];

  return subscribeSelector(
    (state) => getDeepValue(state.values, path as string) as BitPathValue<T, P>,
    listener,
    {
      ...options,
      paths: mergedPaths,
    },
  );
}

export function subscribeStoreFieldState<
  T extends object,
  P extends BitPath<T>,
>(args: {
  path: P;
  listener: (state: Readonly<BitFieldState<T, BitPathValue<T, P>>>) => void;
  getFieldState: (path: P) => Readonly<BitFieldState<T, BitPathValue<T, P>>>;
  subscribeSelector: (
    selector: BitSelector<T, Readonly<BitFieldState<T, BitPathValue<T, P>>>>,
    listener: (state: Readonly<BitFieldState<T, BitPathValue<T, P>>>) => void,
    options?: BitSelectorSubscriptionOptions<
      Readonly<BitFieldState<T, BitPathValue<T, P>>>
    >,
  ) => () => void;
}): () => void {
  const { path, listener, getFieldState, subscribeSelector } = args;

  return subscribeSelector(() => getFieldState(path), listener, {
    paths: [path as string],
    equalityFn: (prev, next) =>
      prev.value === next.value &&
      prev.error === next.error &&
      prev.touched === next.touched &&
      prev.isHidden === next.isHidden &&
      prev.isRequired === next.isRequired &&
      prev.isDirty === next.isDirty &&
      prev.isValidating === next.isValidating,
  });
}

export function subscribeStoreFormMeta<T extends object>(args: {
  listener: (meta: BitFormMeta) => void;
  subscribeSelector: (
    selector: BitSelector<T, BitFormMeta>,
    listener: (meta: BitFormMeta) => void,
    options?: BitSelectorSubscriptionOptions<BitFormMeta>,
  ) => () => void;
}): () => void {
  const { listener, subscribeSelector } = args;

  return subscribeSelector(
    (state) => ({
      isValid: state.isValid,
      isDirty: state.isDirty,
      isSubmitting: state.isSubmitting,
    }),
    listener,
    {
      paths: ["isValid", "isDirty", "isSubmitting"],
      equalityFn: (prev, next) =>
        prev.isValid === next.isValid &&
        prev.isDirty === next.isDirty &&
        prev.isSubmitting === next.isSubmitting,
    },
  );
}

export function subscribeStorePersistMeta<T extends object>(args: {
  listener: (meta: BitPersistMetadata) => void;
  subscribeSelector: (
    selector: BitSelector<T, BitPersistMetadata>,
    listener: (meta: BitPersistMetadata) => void,
    options?: BitSelectorSubscriptionOptions<BitPersistMetadata>,
  ) => () => void;
}): () => void {
  const { listener, subscribeSelector } = args;

  return subscribeSelector((state) => state.persist, listener, {
    paths: ["persist"],
    equalityFn: (prev, next) =>
      prev.isSaving === next.isSaving &&
      prev.isRestoring === next.isRestoring &&
      prev.error === next.error,
  });
}

export function subscribeStoreHistoryMeta<T extends object>(args: {
  readHistoryMeta: () => BitHistoryMetadata;
  subscribeSelector: (
    selector: BitSelector<T, BitHistoryMetadata>,
    listener: (meta: BitHistoryMetadata) => void,
    options?: BitSelectorSubscriptionOptions<BitHistoryMetadata>,
  ) => () => void;
  listener: (meta: BitHistoryMetadata) => void;
}): () => void {
  const { readHistoryMeta, subscribeSelector, listener } = args;

  return subscribeSelector(() => readHistoryMeta(), listener, {
    paths: [getHistorySubscriptionPath()],
    equalityFn: (prev, next) => isHistoryMetaEqual(prev, next),
  });
}

export function subscribeStoreScopeStatus<T extends object>(args: {
  scopeName: string;
  getScopeFields: (scopeName: string) => string[];
  readScopeStatus: (scopeName: string) => ScopeStatus;
  subscribeSelector: (
    selector: BitSelector<T, ScopeStatus>,
    listener: (status: ScopeStatus) => void,
    options?: BitSelectorSubscriptionOptions<ScopeStatus>,
  ) => () => void;
  listener: (status: ScopeStatus) => void;
}): () => void {
  const {
    scopeName,
    getScopeFields,
    readScopeStatus,
    subscribeSelector,
    listener,
  } = args;
  const registryPath = getScopeRegistrySubscriptionPath(scopeName);

  let lastStatus = readScopeStatus(scopeName);
  let unsubscribeScoped = () => {};

  const subscribeScoped = () => {
    unsubscribeScoped();
    const scopePaths = getScopeSubscriptionPaths(getScopeFields(scopeName));

    unsubscribeScoped = subscribeSelector(
      () => readScopeStatus(scopeName),
      (status) => {
        if (isScopeStatusEqual(lastStatus, status)) {
          return;
        }

        lastStatus = status;
        listener(status);
      },
      {
        paths: [...scopePaths, registryPath],
      },
    );
  };

  subscribeScoped();

  const unsubscribeRegistry = subscribeSelector(
    () => getScopeFields(scopeName).length,
    () => {
      subscribeScoped();
      const nextStatus = readScopeStatus(scopeName);
      if (isScopeStatusEqual(lastStatus, nextStatus)) {
        return;
      }

      lastStatus = nextStatus;
      listener(nextStatus);
    },
    {
      paths: [registryPath],
    },
  );

  return () => {
    unsubscribeScoped();
    unsubscribeRegistry();
  };
}
