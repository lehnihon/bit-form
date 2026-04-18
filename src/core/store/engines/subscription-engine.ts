import type {
  BitScopedSelectorSubscriptionOptions,
  BitSelector,
} from "../contracts/public/subscription-types";
import type { BitState } from "../contracts/types";
import { isPathWithinPrefix, normalizePathPrefix } from "../shared/path-prefix";

interface SelectorListenerEntry<T extends object> {
  notify(nextState: Readonly<BitState<T>>): void;
}

const SUBSCRIPTION_ERROR_SOURCE = "subscription";

export interface BitSubscriptionCacheStats {
  cacheSize: number;
  cacheLimit: number;
  cacheHits: number;
  cacheMisses: number;
  cacheEvictions: number;
}

export class BitSubscriptionEngine<T extends object> {
  private listeners: Set<() => void> = new Set();
  private pathScopedSubscriptions: Map<SelectorListenerEntry<T>, string[]> =
    new Map();
  private pathSelectorIndex: Map<string, Set<SelectorListenerEntry<T>>> =
    new Map();
  private readonly pathExpansionCache = new Map<string, string[]>();
  private readonly subscriptionSeenVersion = new Map<
    SelectorListenerEntry<T>,
    number
  >();
  private notifyVersion = 0;
  private readonly MAX_PATH_EXPANSION_CACHE_SIZE: number;
  private cacheHits = 0;
  private cacheMisses = 0;
  private cacheEvictions = 0;
  private readonly onError?: (error: unknown, source: string) => void;

  /**
   * Maximum number of entries for path expansion cache.
   * Lower = less memory; higher = fewer cache evictions in large dynamic forms.
   * @default 500
   */
  constructor(
    private readonly getState: () => Readonly<BitState<T>>,
    onErrorOrMaxCache?: ((error: unknown, source: string) => void) | number,
    maxCacheSize = 500,
  ) {
    if (typeof onErrorOrMaxCache === "function") {
      this.onError = onErrorOrMaxCache;
      this.MAX_PATH_EXPANSION_CACHE_SIZE = maxCacheSize;
      return;
    }

    this.MAX_PATH_EXPANSION_CACHE_SIZE = onErrorOrMaxCache ?? maxCacheSize;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeSelector<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options: BitScopedSelectorSubscriptionOptions<TSlice>,
    equalityFn: (previous: TSlice, next: TSlice) => boolean,
  ): () => void {
    let lastSlice = selector(this.getState());

    const subscription: SelectorListenerEntry<T> = {
      notify: (nextState) => {
        try {
          const nextSlice = selector(nextState);

          if (equalityFn(lastSlice, nextSlice)) {
            return;
          }

          lastSlice = nextSlice;
          listener(nextSlice);
        } catch (error) {
          this.reportError(error);
        }
      },
    };

    const scopedPaths = this.normalizeSubscriptionPaths(options.paths);

    this.pathScopedSubscriptions.set(subscription, scopedPaths);
    scopedPaths.forEach((pathKey) => {
      this.forEachIndexPath(pathKey, (indexPath) => {
        const listeners = this.pathSelectorIndex.get(indexPath) ?? new Set();
        listeners.add(subscription);
        this.pathSelectorIndex.set(indexPath, listeners);
      });
    });

    if (options.emitImmediately) {
      try {
        listener(lastSlice);
      } catch (error) {
        this.reportError(error);
      }
    }

    return () => {
      this.subscriptionSeenVersion.delete(subscription);

      const paths = this.pathScopedSubscriptions.get(subscription);
      if (!paths) return;

      paths.forEach((pathKey) => {
        this.forEachIndexPath(pathKey, (indexPath) => {
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
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        this.reportError(error);
      }
    });

    if (this.pathScopedSubscriptions.size === 0) {
      return;
    }

    const normalizedChangedPaths =
      this.normalizeChangedPathIterable(changedPaths);

    if (
      normalizedChangedPaths.length === 0 ||
      normalizedChangedPaths.includes("*")
    ) {
      this.notifyScopedSubscribers(
        this.pathScopedSubscriptions.keys(),
        nextState,
      );
      return;
    }

    if (
      normalizedChangedPaths.length === 1 &&
      this.isSimplePath(normalizedChangedPaths[0])
    ) {
      const singleScopedSubscribers =
        this.collectSubscribersForSingleChangedPath(normalizedChangedPaths[0]);

      this.notifyScopedSubscribers(singleScopedSubscribers, nextState);
      return;
    }

    const scopedSubscribers = this.collectSubscribersForChangedPaths(
      normalizedChangedPaths,
    );

    this.notifyScopedSubscribers(scopedSubscribers, nextState);
  }

  private notifyScopedSubscribers(
    subscriptions: Iterable<SelectorListenerEntry<T>>,
    nextState: Readonly<BitState<T>>,
  ): void {
    for (const subscription of subscriptions) {
      try {
        subscription.notify(nextState);
      } catch (error) {
        this.reportError(error);
      }
    }
  }

  private reportError(error: unknown): void {
    if (this.onError) {
      this.onError(error, SUBSCRIPTION_ERROR_SOURCE);
      return;
    }

    console.error("Subscription listener error:", error);
  }

  destroy(): void {
    this.listeners.clear();
    this.pathScopedSubscriptions.clear();
    this.pathSelectorIndex.clear();
    this.pathExpansionCache.clear();
    this.subscriptionSeenVersion.clear();
  }

  getPathExpansionCacheStats(): BitSubscriptionCacheStats {
    return {
      cacheSize: this.pathExpansionCache.size,
      cacheLimit: this.MAX_PATH_EXPANSION_CACHE_SIZE,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheEvictions: this.cacheEvictions,
    };
  }

  getActiveSubscribersCount(): number {
    return this.pathScopedSubscriptions.size;
  }

  invalidatePathExpansionCache(prefix?: string): void {
    if (!prefix) {
      this.pathExpansionCache.clear();
      return;
    }

    const normalizedPrefix = normalizePathPrefix(prefix);
    if (normalizedPrefix.length === 0) {
      this.pathExpansionCache.clear();
      return;
    }

    for (const key of this.pathExpansionCache.keys()) {
      if (
        isPathWithinPrefix(key, normalizedPrefix) ||
        isPathWithinPrefix(normalizedPrefix, key)
      ) {
        this.pathExpansionCache.delete(key);
      }
    }
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

  private normalizeChangedPathIterable(paths?: Iterable<string>): string[] {
    if (!paths) {
      return [];
    }

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
    // Wrap in 32-bit signed integer to avoid Number.MAX_SAFE_INTEGER stall:
    // ++x at MAX_SAFE_INTEGER returns MAX_SAFE_INTEGER again, making the
    // `seenVersion >= currentVersion` guard fire on every subsequent call and
    // silently stopping all scoped subscribers. Bitwise OR forces 32-bit wrap.
    this.notifyVersion = (this.notifyVersion + 1) | 0;
    const currentVersion = this.notifyVersion;

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
      this.forEachLookupPath(changedPath, addByPath);
    });

    return scopedSubscribers;
  }

  private collectSubscribersForSingleChangedPath(
    changedPath: string,
  ): SelectorListenerEntry<T>[] {
    const scopedSubscribers: SelectorListenerEntry<T>[] = [];
    this.notifyVersion = (this.notifyVersion + 1) | 0;
    const currentVersion = this.notifyVersion;

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

    this.forEachLookupPath(changedPath, addByPath);
    return scopedSubscribers;
  }

  private expandChangedPathForLookup(path: string): string[] {
    // Use unified expansion cache
    return this.expandPathGeneric(path);
  }

  private expandPathForIndexing(path: string): string[] {
    // Use unified expansion cache
    return this.expandPathGeneric(path);
  }

  private forEachIndexPath(
    path: string,
    visitor: (path: string) => void,
  ): void {
    if (!this.isSimplePath(path)) {
      this.expandPathForIndexing(path).forEach(visitor);
      return;
    }

    const segments = path.split(".");
    let currentPath = "";

    for (let index = 0; index < segments.length; index += 1) {
      currentPath = currentPath
        ? `${currentPath}.${segments[index]}`
        : segments[index];
      visitor(currentPath);
    }
  }

  private forEachLookupPath(
    path: string,
    visitor: (path: string) => void,
  ): void {
    if (!this.isSimplePath(path)) {
      this.expandChangedPathForLookup(path).forEach(visitor);
      return;
    }

    visitor(path);

    let separatorIndex = path.lastIndexOf(".");
    while (separatorIndex > -1) {
      visitor(path.slice(0, separatorIndex));
      separatorIndex = path.lastIndexOf(".", separatorIndex - 1);
    }
  }

  private isSimplePath(path: string): boolean {
    return !path.includes("*") && !path.includes("[") && !path.includes("]");
  }

  private expandPathGeneric(path: string): string[] {
    const cached = this.pathExpansionCache.get(path);
    if (cached) {
      this.cacheHits += 1;
      return cached;
    }

    this.cacheMisses += 1;

    const segments = path.split(".");
    const keys: string[] = [];
    for (let i = 1; i <= segments.length; i++) {
      keys.push(segments.slice(0, i).join("."));
    }
    this.setBoundedCacheEntry(
      this.pathExpansionCache,
      path,
      keys,
      this.MAX_PATH_EXPANSION_CACHE_SIZE,
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
        this.cacheEvictions += 1;
      }
    }

    cache.set(key, value);
  }
}
