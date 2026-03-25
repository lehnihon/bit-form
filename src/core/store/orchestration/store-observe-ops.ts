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
  getStepRegistrySubscriptionPath,
  getStepSubscriptionPaths,
  isStepStatusEqual,
} from "../shared/step-status";

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
  subscribe: (listener: () => void) => () => void;
  listener: (meta: BitHistoryMetadata) => void;
}): () => void {
  const { readHistoryMeta, subscribe, listener } = args;
  let lastMeta = readHistoryMeta();

  return subscribe(() => {
    const nextMeta = readHistoryMeta();

    if (isHistoryMetaEqual(lastMeta, nextMeta)) {
      return;
    }

    lastMeta = nextMeta;
    listener(nextMeta);
  });
}

export function subscribeStoreScopeStatus<T extends object>(args: {
  scopeName: string;
  readScopeStatus: (scopeName: string) => ScopeStatus;
  getScopeFields: (scopeName: string) => string[];
  subscribeSelector: (
    selector: BitSelector<T, { status: ScopeStatus; scopeSignature: string }>,
    listener: (slice: { status: ScopeStatus; scopeSignature: string }) => void,
    options?: BitSelectorSubscriptionOptions<{
      status: ScopeStatus;
      scopeSignature: string;
    }>,
  ) => () => void;
  listener: (status: ScopeStatus) => void;
}): () => void {
  const {
    scopeName,
    readScopeStatus,
    getScopeFields,
    subscribeSelector,
    listener,
  } = args;

  const buildScopedPaths = () => [
    ...getStepSubscriptionPaths(getScopeFields(scopeName)),
    getStepRegistrySubscriptionPath(scopeName),
  ];

  const arePathSetsEqual = (
    currentPaths: readonly string[],
    nextPaths: readonly string[],
  ) => {
    if (currentPaths.length !== nextPaths.length) {
      return false;
    }

    const nextSet = new Set(nextPaths);
    return currentPaths.every((path) => nextSet.has(path));
  };

  let activePaths = buildScopedPaths();
  let activeUnsubscribe: (() => void) | null = null;
  let lastStatus = readScopeStatus(scopeName);

  const subscribeWithPaths = (paths: string[]) => {
    activeUnsubscribe = subscribeSelector(
      () => ({
        status: readScopeStatus(scopeName),
        scopeSignature: getScopeFields(scopeName).join("|"),
      }),
      (slice) => {
        const nextPaths = buildScopedPaths();
        const shouldRebind = !arePathSetsEqual(activePaths, nextPaths);
        const hasStatusChange = !isStepStatusEqual(lastStatus, slice.status);

        if (hasStatusChange) {
          lastStatus = slice.status;
          listener(slice.status);
        }

        if (shouldRebind) {
          activePaths = nextPaths;
          activeUnsubscribe?.();
          subscribeWithPaths(activePaths);
        }
      },
      {
        paths,
        equalityFn: (prev, next) =>
          isStepStatusEqual(prev.status, next.status) &&
          prev.scopeSignature === next.scopeSignature,
      },
    );
  };

  subscribeWithPaths(activePaths);

  return () => {
    activeUnsubscribe?.();
    activeUnsubscribe = null;
  };
}
