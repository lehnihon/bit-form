import type {
  BitSelector,
  BitScopedSelectorSubscriptionOptions,
  BitSelectorSubscriptionOptions,
  BitTrackedSelectorSubscriptionOptions,
} from "../contracts/public/subscription-types";
import type { BitState } from "../contracts/types";

export function collectTrackedSelectorPaths<T extends object, TSlice>(
  state: Readonly<BitState<T>>,
  selector: BitSelector<T, TSlice>,
): string[] {
  const trackedPaths = new Set<string>();

  const createTrackingProxy = <TValue>(
    value: TValue,
    basePath: string,
  ): TValue => {
    if (value === null || typeof value !== "object") {
      return value;
    }

    return new Proxy(value as object, {
      get: (target, key, receiver) => {
        if (typeof key === "symbol") {
          return Reflect.get(target, key, receiver);
        }

        const keyAsString = String(key);
        const childPath = basePath ? `${basePath}.${keyAsString}` : keyAsString;
        trackedPaths.add(childPath);

        const child = Reflect.get(target, key, receiver);
        return createTrackingProxy(child, childPath);
      },
    }) as TValue;
  };

  const proxyState = createTrackingProxy(state, "");
  selector(proxyState as Readonly<BitState<T>>);

  const normalizedPaths = new Set<string>();

  trackedPaths.forEach((path) => {
    const normalizedPath = normalizeTrackedPath(path);
    if (normalizedPath) {
      normalizedPaths.add(normalizedPath);
    }
  });

  return Array.from(normalizedPaths);
}

function normalizeTrackedPath(path: string): string | undefined {
  if (!path) {
    return undefined;
  }

  if (path === "values") {
    return "*";
  }

  if (path.startsWith("values.")) {
    return path.slice("values.".length);
  }

  if (path === "errors" || path === "touched" || path === "isValidating") {
    return "*";
  }

  if (path.startsWith("errors.")) {
    return path.slice("errors.".length);
  }

  if (path.startsWith("touched.")) {
    return path.slice("touched.".length);
  }

  if (path.startsWith("isValidating.")) {
    return path.slice("isValidating.".length);
  }

  if (path === "persist" || path.startsWith("persist.")) {
    return "persist";
  }

  return path;
}

export function areTrackedPathSetsEqual(
  previousPaths: readonly string[],
  nextPaths: readonly string[],
): boolean {
  if (previousPaths.length !== nextPaths.length) {
    return false;
  }

  const next = new Set(nextPaths);
  for (const path of previousPaths) {
    if (!next.has(path)) {
      return false;
    }
  }

  return true;
}

export function withTrackedSelectorPaths<TValue>(
  paths: string[],
  options?: BitTrackedSelectorSubscriptionOptions<TValue>,
): BitScopedSelectorSubscriptionOptions<TValue> {
  if (paths.length === 0) {
    return {
      emitImmediately: options?.emitImmediately,
      equalityFn: options?.equalityFn,
      mode: "scoped",
      paths: ["*"],
    };
  }

  return {
    emitImmediately: options?.emitImmediately,
    equalityFn: options?.equalityFn,
    mode: "scoped",
    paths,
  };
}

export function createTrackedSubscription<T extends object, TSlice>(args: {
  getState: () => Readonly<BitState<T>>;
  subscribeSelector: (
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options?: BitScopedSelectorSubscriptionOptions<TSlice>,
  ) => () => void;
  selector: BitSelector<T, TSlice>;
  listener: (slice: TSlice) => void;
  options?: BitTrackedSelectorSubscriptionOptions<TSlice>;
}): () => void {
  const { getState, subscribeSelector, selector, listener, options } = args;

  let activeUnsubscribe: (() => void) | null = null;
  let activePaths = collectTrackedSelectorPaths(getState(), selector);
  let isDisposed = false;
  let isResubscribeQueued = false;

  const subscribeWithPaths = (paths: string[]) => {
    activeUnsubscribe = subscribeSelector(
      selector,
      (slice) => {
        listener(slice);

        const nextPaths = collectTrackedSelectorPaths(getState(), selector);
        if (areTrackedPathSetsEqual(activePaths, nextPaths)) {
          return;
        }

        activePaths = nextPaths;

        if (isResubscribeQueued || isDisposed) {
          return;
        }

        isResubscribeQueued = true;
        queueMicrotask(() => {
          isResubscribeQueued = false;
          if (isDisposed) {
            return;
          }

          activeUnsubscribe?.();
          subscribeWithPaths(activePaths);
        });
      },
      withTrackedSelectorPaths(paths, options),
    );
  };

  subscribeWithPaths(activePaths);

  return () => {
    isDisposed = true;
    activeUnsubscribe?.();
    activeUnsubscribe = null;
  };
}
