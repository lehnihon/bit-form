import { useCallback, useSyncExternalStore } from "react";
import { useBitStore } from "./context";
import { getDeepValue } from "../core";

export function useBitWatch<T = any>(path: string): T {
  const store = useBitStore();

  const getSnapshot = useCallback(() => {
    const value = getDeepValue(store.getState().values, path);
    return value as T;
  }, [store, path]);

  return useSyncExternalStore(
    store.subscribe.bind(store),
    getSnapshot,
    getSnapshot,
  );
}
