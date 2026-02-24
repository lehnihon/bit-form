import { useCallback, useSyncExternalStore, useRef } from "react";
import { useBitStore } from "./context";
import { getDeepValue, deepEqual, BitPath, BitPathValue } from "../core";

export function useBitWatch<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(path: P): BitPathValue<TForm, P> {
  const store = useBitStore<TForm>();
  const lastValue = useRef<BitPathValue<TForm, P> | null>(null);

  const getSnapshot = useCallback(() => {
    const value = getDeepValue(
      store.getState().values,
      path as string,
    ) as BitPathValue<TForm, P>;

    if (
      lastValue.current !== null &&
      deepEqual(lastValue.current, value)
    ) {
      return lastValue.current;
    }

    lastValue.current = value;
    return value;
  }, [store, path]);

  const subscribe = useCallback(
    (cb: () => void) => store.subscribe(cb),
    [store],
  );

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  ) as BitPathValue<TForm, P>;
}
