import type {
  BitSelector,
  BitSelectorSubscriptionOptions,
} from "../contracts/public/subscription-types";
import type { BitState } from "../contracts/types";

interface SelectorListenerEntry<T extends object> {
  notify(nextState: Readonly<BitState<T>>): void;
}

export class BitSubscriptionEngine<T extends object> {
  private listeners: Set<() => void> = new Set();
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
  private readonly MAX_EXPANDED_CACHE_SIZE: number;
  private readonly MAX_CHANGED_LOOKUP_CACHE_SIZE: number;

  constructor(
    private readonly getState: () => Readonly<BitState<T>>,
    /**
     * Maximum number of entries for each internal LRU path cache.
     * Lower = less memory; higher = fewer cache evictions in large dynamic forms.
     * @default 500
     */
    maxCacheSize = 500,
  ) {
    this.MAX_EXPANDED_CACHE_SIZE = maxCacheSize;
    this.MAX_CHANGED_LOOKUP_CACHE_SIZE = maxCacheSize;
  }

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

    const scopedPaths = this.normalizeSubscriptionPaths(options?.paths);

    if (scopedPaths.length === 0) {
      throw new Error("BitStore: subscribeSelector requires explicit `paths`.");
    }

    this.pathScopedSubscriptions.set(subscription, scopedPaths);
    scopedPaths.forEach((pathKey) => {
      this.expandPathForIndexing(pathKey).forEach((indexPath) => {
        const listeners = this.pathSelectorIndex.get(indexPath) ?? new Set();
        listeners.add(subscription);
        this.pathSelectorIndex.set(indexPath, listeners);
      });
    });

    if (options?.emitImmediately) {
      listener(lastSlice);
    }

    return () => {
      this.subscriptionSeenVersion.delete(subscription);

      const paths = this.pathScopedSubscriptions.get(subscription);
      if (!paths) return;

      paths.forEach((pathKey) => {
        this.expandPathForIndexing(pathKey).forEach((indexPath) => {
          const listeners = this.pathSelectorIndex.get(indexPath);
          if (!listeners) return;

          listeners.delete(subscription);
          if (listeners.size === 0) {
            this.pathSelectorIndex.delete(indexPath);
          }
        });
      });

      this.pathScopedSubscriptions.delete(subscription);
    };
  }

  notify(
    nextState: Readonly<BitState<T>>,
    changedPaths?: Iterable<string>,
  ): void {
    this.listeners.forEach((listener) => listener());

    if (this.pathScopedSubscriptions.size === 0) {
      return;
    }

    const normalizedChangedPaths = changedPaths
      ? this.normalizeSubscriptionPaths(Array.from(changedPaths))
      : [];

    if (
      normalizedChangedPaths.length === 0 ||
      normalizedChangedPaths.includes("*")
    ) {
      this.pathScopedSubscriptions.forEach((_paths, subscription) => {
        subscription.notify(nextState);
      });
      return;
    }

    const scopedSubscribers = this.collectSubscribersForChangedPaths(
      normalizedChangedPaths,
    );

    scopedSubscribers.forEach((subscription) => {
      subscription.notify(nextState);
    });
  }

  destroy(): void {
    this.listeners.clear();
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
        if (seenVersion >= currentVersion) {
          return;
        }

        this.subscriptionSeenVersion.set(subscription, currentVersion);
        scopedSubscribers.push(subscription);
      });
    };

    changedPaths.forEach((changedPath) => {
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

    this.setBoundedCacheEntry(
      this.changedPathLookupCache,
      path,
      lookupPaths,
      this.MAX_CHANGED_LOOKUP_CACHE_SIZE,
    );
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
    this.setBoundedCacheEntry(
      this.expandedPathCache,
      path,
      keys,
      this.MAX_EXPANDED_CACHE_SIZE,
    );
    return keys;
  }

  private setBoundedCacheEntry<K, V>(
    cache: Map<K, V>,
    key: K,
    value: V,
    maxSize: number,
  ) {
    if (cache.size >= maxSize) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }

    cache.set(key, value);
  }
}
