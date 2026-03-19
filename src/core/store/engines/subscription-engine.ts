import type {
  BitSelector,
  BitSelectorSubscriptionOptions,
} from "../contracts/public-types";
import type { BitState } from "../contracts/types";

interface SelectorListenerEntry<T extends object> {
  notify(nextState: Readonly<BitState<T>>): void;
}

export class BitSubscriptionEngine<T extends object> {
  private listeners: Set<() => void> = new Set();
  private selectorListeners: Set<SelectorListenerEntry<T>> = new Set();
  private pathScopedSubscriptions: Map<SelectorListenerEntry<T>, string[]> =
    new Map();
  private pathSelectorIndex: Map<string, Set<SelectorListenerEntry<T>>> =
    new Map();
  private readonly expandedPathCache = new Map<string, string[]>();
  private readonly changedPathLookupCache = new Map<string, string[]>();
  private readonly subscriptionSeenVersion = new Map<
    SelectorListenerEntry<T>,
    number
  >();
  private notifyVersion = 0;

  /**
   * Cleanup interval for phantom subscription paths (paths with no active listeners)
   * Prevents unbounded growth of pathSelectorIndex when array fields grow dynamically
   * Triggered every 100 notify() calls or manually via cleanupPhantomPaths()
   */
  private notifyCount = 0;
  private readonly CLEANUP_INTERVAL = 100;

  constructor(private readonly getState: () => Readonly<BitState<T>>) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeSelector<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options: BitSelectorSubscriptionOptions<TSlice> | undefined,
    equalityFn: (previous: TSlice, next: TSlice) => boolean,
  ): () => void {
    let lastSlice = selector(this.getState());

    const subscription: SelectorListenerEntry<T> = {
      notify: (nextState) => {
        const nextSlice = selector(nextState);

        if (equalityFn(lastSlice, nextSlice)) {
          return;
        }

        lastSlice = nextSlice;
        listener(nextSlice);
      },
    };

    const autoTrackedPaths = options?.autoTrackPaths
      ? this.collectTrackedSelectorPaths(selector)
      : [];

    if (
      options?.autoTrackPaths &&
      typeof process !== "undefined" &&
      process.env?.["NODE_ENV"] !== "production"
    ) {
      console.warn(
        "[bit-form] subscribeSelector: autoTrackPaths creates Proxy wrappers " +
          "to detect accessed paths at subscription time. For high-frequency " +
          "or dynamically-rendered fields (e.g. field arrays), prefer " +
          "explicit `paths: [...]` to avoid mount-time overhead.",
      );
    }

    const scopedPaths = this.normalizeSubscriptionPaths([
      ...(options?.paths ?? []),
      ...autoTrackedPaths,
    ]);

    if (scopedPaths.length > 0) {
      this.pathScopedSubscriptions.set(subscription, scopedPaths);
      scopedPaths.forEach((pathKey) => {
        this.expandPathForIndexing(pathKey).forEach((indexPath) => {
          const listeners = this.pathSelectorIndex.get(indexPath) ?? new Set();
          listeners.add(subscription);
          this.pathSelectorIndex.set(indexPath, listeners);
        });
      });
    } else {
      this.selectorListeners.add(subscription);
    }

    if (options?.emitImmediately) {
      listener(lastSlice);
    }

    return () => {
      this.selectorListeners.delete(subscription);

      const paths = this.pathScopedSubscriptions.get(subscription);
      if (!paths) return;

      paths.forEach((pathKey) => {
        this.expandPathForIndexing(pathKey).forEach((indexPath) => {
          const listeners = this.pathSelectorIndex.get(indexPath);
          if (!listeners) return;

          listeners.delete(subscription);
          this.subscriptionSeenVersion.delete(subscription);
          if (listeners.size === 0) {
            this.pathSelectorIndex.delete(indexPath);
          }
        });
      });

      this.pathScopedSubscriptions.delete(subscription);
    };
  }

  notify(nextState: Readonly<BitState<T>>, changedPaths?: string[]): void {
    this.listeners.forEach((listener) => listener());

    this.selectorListeners.forEach((subscription) => {
      subscription.notify(nextState);
    });

    if (this.pathScopedSubscriptions.size === 0) {
      return;
    }

    if (
      !changedPaths ||
      changedPaths.length === 0 ||
      changedPaths.includes("*")
    ) {
      this.pathScopedSubscriptions.forEach((_paths, subscription) => {
        subscription.notify(nextState);
      });
      return;
    }

    const scopedSubscribers =
      this.collectSubscribersForChangedPaths(changedPaths);

    scopedSubscribers.forEach((subscription) => {
      subscription.notify(nextState);
    });

    // Periodically cleanup phantom subscription paths to prevent unbounded growth
    this.notifyCount++;
    if (this.notifyCount >= this.CLEANUP_INTERVAL) {
      this.cleanupPhantomPaths();
      this.notifyCount = 0;
    }
  }

  /**
   * Remove paths from pathSelectorIndex that have no active subscribers
   * Prevents memory creep in scenarios with dynamic array fields
   */
  private cleanupPhantomPaths(): void {
    const phantomPaths = new Set<string>();

    for (const [path, listeners] of this.pathSelectorIndex.entries()) {
      if (listeners.size === 0) {
        phantomPaths.add(path);
      }
    }

    phantomPaths.forEach((path) => {
      this.pathSelectorIndex.delete(path);
    });
  }

  destroy(): void {
    this.listeners.clear();
    this.selectorListeners.clear();
    this.pathScopedSubscriptions.clear();
    this.pathSelectorIndex.clear();
    this.expandedPathCache.clear();
    this.changedPathLookupCache.clear();
    this.subscriptionSeenVersion.clear();
  }

  private normalizeSubscriptionPaths(paths?: string[]): string[] {
    if (!paths || paths.length === 0) return [];

    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const path of paths) {
      const trimmed = path.trim();
      if (trimmed.length === 0 || seen.has(trimmed)) {
        continue;
      }

      seen.add(trimmed);
      normalized.push(trimmed);
    }

    return normalized;
  }

  private collectTrackedSelectorPaths<TSlice>(
    selector: BitSelector<T, TSlice>,
  ): string[] {
    const trackedPaths = new Set<string>();

    const createTrackedProxy = (
      value: unknown,
      currentPath: string,
    ): unknown => {
      if (!value || typeof value !== "object") {
        return value;
      }

      return new Proxy(value as Record<string, unknown>, {
        get: (target, key) => {
          if (typeof key !== "string") {
            return Reflect.get(target, key);
          }

          const nextPath = currentPath ? `${currentPath}.${key}` : key;
          trackedPaths.add(nextPath);

          const nextValue = Reflect.get(target, key);
          return createTrackedProxy(nextValue, nextPath);
        },
      });
    };

    const trackedState = new Proxy(
      this.getState() as unknown as Record<string, unknown>,
      {
        get: (target, key) => {
          if (typeof key !== "string") {
            return Reflect.get(target, key);
          }

          const value = Reflect.get(target, key);

          if (key === "values") {
            return createTrackedProxy(value, "");
          }

          return value;
        },
      },
    ) as Readonly<BitState<T>>;

    try {
      selector(trackedState);
      return Array.from(trackedPaths);
    } catch {
      return [];
    }
  }

  private collectSubscribersForChangedPaths(
    changedPaths: string[],
  ): SelectorListenerEntry<T>[] {
    const scopedSubscribers: SelectorListenerEntry<T>[] = [];
    const currentVersion = ++this.notifyVersion;

    const addByPath = (path: string) => {
      const listeners = this.pathSelectorIndex.get(path);
      if (!listeners) return;

      listeners.forEach((subscription) => {
        const seenVersion = this.subscriptionSeenVersion.get(subscription) ?? 0;
        // Reentrant-safe dedupe: nested notify() may stamp a newer version;
        // treat newer or equal as already seen in this or deeper call stack.
        if (seenVersion >= currentVersion) {
          return;
        }

        this.subscriptionSeenVersion.set(subscription, currentVersion);
        scopedSubscribers.push(subscription);
      });
    };

    const normalizedChangedPaths =
      this.normalizeSubscriptionPaths(changedPaths);

    normalizedChangedPaths.forEach((changedPath) => {
      this.expandChangedPathForLookup(changedPath).forEach(addByPath);
    });

    return scopedSubscribers;
  }

  private expandChangedPathForLookup(path: string): string[] {
    const cached = this.changedPathLookupCache.get(path);
    if (cached) {
      return cached;
    }

    const parts = path.split(".");
    const lookupPaths: string[] = [path];

    while (parts.length > 1) {
      parts.pop();
      lookupPaths.push(parts.join("."));
    }

    this.changedPathLookupCache.set(path, lookupPaths);
    return lookupPaths;
  }

  private expandPathForIndexing(path: string): string[] {
    const cached = this.expandedPathCache.get(path);
    if (cached) {
      return cached;
    }

    const segments = path.split(".");
    const keys: string[] = [];
    for (let i = 1; i <= segments.length; i++) {
      keys.push(segments.slice(0, i).join("."));
    }
    this.expandedPathCache.set(path, keys);
    return keys;
  }
}
