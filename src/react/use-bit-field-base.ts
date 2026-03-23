import { useCallback, useSyncExternalStore, useRef, useEffect } from "react";
import { useBitStore } from "./context";
import { BitPath, BitPathValue } from "../core";
import { cleanupRegisteredField } from "../core/bindings/framework-cleanup";
import { subscribeFieldState } from "../core/field-controller";
import {
  createFieldStateSnapshot,
  BitFieldSnapshot,
} from "../core/utils/field-state-snapshot";

export function useBitFieldBase<
  TValue = any,
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(path: P) {
  const store = useBitStore<TForm>();
  const lastSnapshot = useRef<BitFieldSnapshot<BitPathValue<TForm, P>> | null>(
    null,
  );

  useEffect(() => {
    return () => cleanupRegisteredField(store, path as string);
  }, [store, path]);

  const getSnapshot = useCallback(() => {
    const nextState = store.getFieldState(path);
    const snapshot = createFieldStateSnapshot(nextState, lastSnapshot.current);
    lastSnapshot.current = snapshot;
    return snapshot;
  }, [store, path]);

  const subscribe = useCallback(
    (cb: () => void) => subscribeFieldState(store, path, () => cb()),
    [store, path],
  );

  const fieldState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setValue = useCallback(
    (val: BitPathValue<TForm, P>) => store.setField(path, val),
    [store, path],
  );

  const setBlur = useCallback(() => store.blurField(path), [store, path]);

  return { fieldState, setValue, setBlur, store };
}
