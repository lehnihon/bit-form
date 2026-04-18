import {
  getHistorySubscriptionPath,
  isHistoryMetaEqual,
} from "../../history-status";
import { getDeepValue, valueEqual } from "../../utils";
import { areFieldStatesEqual } from "../../utils/field-state-snapshot";
import type {
  BitFormMeta,
  BitHistoryMetadata,
} from "../contracts/public/meta-types";
import type {
  BitScopedSelectorSubscriptionOptions,
  BitSelector,
  BitSelectorSubscriptionOptions,
} from "../contracts/public/subscription-types";
import type {
  BitFieldState,
  BitPath,
  BitPathValue,
  BitPersistMetadata,
  BitState,
  ScopeStatus,
} from "../contracts/types";
import type { BitSubscriptionEngine } from "../engines/subscription-engine";
import {
  getScopeRegistrySubscriptionPath,
  getScopeSubscriptionPaths,
  isScopeStatusEqual,
} from "../shared/scope-status";
import { createTrackedSubscription } from "./tracked-selector";

export function subscribeStoreSelector<T extends object, TSlice>(args: {
  getState: () => Readonly<BitState<T>>;
  subscriptions: Pick<BitSubscriptionEngine<T>, "subscribeSelector">;
  selector: BitSelector<T, TSlice>;
  listener: (slice: TSlice) => void;
  options: BitSelectorSubscriptionOptions<TSlice>;
  trackedSubscriptionsEnabled: boolean;
  onUnhandledError?: (error: unknown, source: string) => void;
}): () => void {
  const {
    getState,
    subscriptions,
    selector,
    listener,
    options,
    trackedSubscriptionsEnabled,
    onUnhandledError,
  } = args;
  const equalityFn = options?.equalityFn ?? valueEqual;

  if (options?.mode === "tracked") {
    if (!trackedSubscriptionsEnabled) {
      // Do NOT throw — a synchronous throw here would propagate through the
      // framework's rendering cycle and crash the entire component tree.
      // Route via onUnhandledError and return a no-op so the call site stays
      // functional (the subscription simply won't fire).
      onUnhandledError?.(
        new Error(
          'BitForm: subscribeSelector com mode="tracked" está desabilitado por padrão. Ative config.trackedSubscriptions=true para habilitar o modo avançado.',
        ),
        "subscription",
      );
      return () => {};
    }

    return createTrackedSubscription({
      getState,
      subscribeSelector: (trackedSelector, trackedListener, trackedOptions) =>
        subscriptions.subscribeSelector(
          trackedSelector,
          trackedListener,
          trackedOptions,
          equalityFn,
        ),
      selector,
      listener,
      options,
    });
  }

  return subscriptions.subscribeSelector(
    selector,
    listener,
    options,
    equalityFn,
  );
}

export function subscribeStorePath<
  T extends object,
  P extends BitPath<T>,
>(args: {
  path: P;
  listener: (value: BitPathValue<T, P>) => void;
  options?: BitScopedSelectorSubscriptionOptions<BitPathValue<T, P>>;
  subscribeSelector: (
    selector: BitSelector<T, BitPathValue<T, P>>,
    listener: (slice: BitPathValue<T, P>) => void,
    options: BitSelectorSubscriptionOptions<BitPathValue<T, P>>,
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
    options: BitSelectorSubscriptionOptions<
      Readonly<BitFieldState<T, BitPathValue<T, P>>>
    >,
  ) => () => void;
}): () => void {
  const { path, listener, getFieldState, subscribeSelector } = args;

  return subscribeSelector(() => getFieldState(path), listener, {
    paths: [path as string],
    equalityFn: areFieldStatesEqual,
  });
}

export function subscribeStoreFormMeta<T extends object>(args: {
  listener: (meta: BitFormMeta) => void;
  subscribeSelector: (
    selector: BitSelector<T, BitFormMeta>,
    listener: (meta: BitFormMeta) => void,
    options: BitSelectorSubscriptionOptions<BitFormMeta>,
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
    options: BitSelectorSubscriptionOptions<BitPersistMetadata>,
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
    options: BitSelectorSubscriptionOptions<BitHistoryMetadata>,
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
  subscribeSelector: <TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options: BitSelectorSubscriptionOptions<TSlice>,
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

  let resubscribeQueued = false;
  // Tracks whether the caller has unsubscribed. The queueMicrotask callback
  // captures this flag so it can bail out if cleanup happens before the
  // microtask fires — preventing orphan subscriptions and setState calls on
  // unmounted components.
  let destroyed = false;

  const unsubscribeRegistry = subscribeSelector(
    () => getScopeFields(scopeName).length,
    () => {
      // Coalesce rapid registry changes (e.g. two fields with same scope
      // registered in a single batch) via queueMicrotask to prevent the
      // second re-subscription from orphaning the one just created by the first.
      if (resubscribeQueued) return;
      resubscribeQueued = true;

      queueMicrotask(() => {
        resubscribeQueued = false;
        // If the caller unsubscribed while this microtask was queued, do
        // nothing: creating a new scoped subscription here would leak it
        // (no one holds a reference to unsubscribe it), and calling listener
        // would update state on an already-unmounted component.
        if (destroyed) return;
        subscribeScoped();
        const nextStatus = readScopeStatus(scopeName);
        if (isScopeStatusEqual(lastStatus, nextStatus)) {
          return;
        }

        lastStatus = nextStatus;
        listener(nextStatus);
      });
    },
    {
      paths: [registryPath],
    },
  );

  return () => {
    destroyed = true;
    unsubscribeScoped();
    unsubscribeRegistry();
  };
}
