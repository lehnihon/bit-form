import { useCallback, useSyncExternalStore, useRef } from "react";
import { useBitStore } from "./context";
import { getDeepValue, deepEqual } from "../core"; // Certifique-se de que deepEqual está exportado do core

export function useBitWatch<T = any>(path: string): T {
  const store = useBitStore();
  const lastValue = useRef<T | null>(null);

  const getSnapshot = useCallback(() => {
    const value = getDeepValue(store.getState().values, path) as T;

    if (lastValue.current !== null && deepEqual(lastValue.current, value)) {
      return lastValue.current;
    }

    lastValue.current = value;
    return value;
  }, [store, path]);

  const subscribe = useCallback(
    (cb: () => void) => store.subscribe(cb),
    [store],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
