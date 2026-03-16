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

    const autoTrackedPaths =
      options?.autoTrackPaths === false
        ? []
        : this.collectTrackedSelectorPaths(selector);

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
  }

  destroy(): void {
    this.listeners.clear();
    this.selectorListeners.clear();
    this.pathScopedSubscriptions.clear();
    this.pathSelectorIndex.clear();
  }

  private normalizeSubscriptionPaths(paths?: string[]): string[] {
    if (!paths || paths.length === 0) return [];

    return Array.from(
      new Set(
        paths.map((path) => path.trim()).filter((path) => path.length > 0),
      ),
    );
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
  ): Set<SelectorListenerEntry<T>> {
    const scopedSubscribers = new Set<SelectorListenerEntry<T>>();

    const addByPath = (path: string) => {
      const listeners = this.pathSelectorIndex.get(path);
      if (!listeners) return;
      listeners.forEach((subscription) => scopedSubscribers.add(subscription));
    };

    const normalizedChangedPaths =
      this.normalizeSubscriptionPaths(changedPaths);

    normalizedChangedPaths.forEach((changedPath) => {
      addByPath(changedPath);

      const parts = changedPath.split(".");
      while (parts.length > 1) {
        parts.pop();
        addByPath(parts.join("."));
      }

    });

    return scopedSubscribers;
  }

  private expandPathForIndexing(path: string): string[] {
    const segments = path.split(".");
    const keys: string[] = [];
    for (let i = 1; i <= segments.length; i++) {
      keys.push(segments.slice(0, i).join("."));
    }
    return keys;
  }

}
