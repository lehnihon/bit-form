import type { BitConfig, BitFrameworkStoreApi, BitStoreApi } from "../core";
import { createBitStore } from "../core";
import { resolveReactStore } from "../react/store";
import { useBitArray } from "../react/use-bit-array";
import { useBitForm } from "../react/use-bit-form";
import { useBitPersist } from "../react/use-bit-persist";
import { useBitScope } from "../react/use-bit-scope";
import { useBitSteps } from "../react/use-bit-steps";
import { useBitWatch } from "../react/use-bit-watch";
import { useBitField } from "./use-bit-field";

export interface BitReactNativeBindings<TForm extends object = any> {
  useBitForm: () => ReturnType<typeof useBitForm<TForm>>;
  useBitArray: <P extends import("../core").BitArrayPath<TForm>>(
    path: P,
  ) => ReturnType<typeof useBitArray<TForm, P>>;
  useBitScope: (scopeName: string) => ReturnType<typeof useBitScope<TForm>>;
  useBitSteps: (scopeNames: string[]) => ReturnType<typeof useBitSteps<TForm>>;
  useBitWatch: <P extends import("../core").BitPath<TForm>>(
    path: P,
  ) => ReturnType<typeof useBitWatch<TForm, P>>;
  useBitField: <P extends import("../core").BitPath<TForm>>(
    path: P,
  ) => ReturnType<typeof useBitField<TForm, P>>;
  useBitPersist: () => ReturnType<typeof useBitPersist<TForm>>;
}

const bindingCache = new WeakMap<object, BitReactNativeBindings<any>>();

export function createBitReactNativeBindings<TForm extends object>(
  storeInput: BitFrameworkStoreApi<TForm> | BitStoreApi<TForm>,
): BitReactNativeBindings<TForm> {
  const store = resolveReactStore(storeInput);
  const cached = bindingCache.get(store as object) as
    | BitReactNativeBindings<TForm>
    | undefined;
  if (cached) {
    return cached;
  }

  const bindings: BitReactNativeBindings<TForm> = {
    useBitForm: () => useBitForm(store),
    useBitArray: (path) => useBitArray(store, path),
    useBitScope: (scopeName) => useBitScope(store, scopeName),
    useBitSteps: (scopeNames) => useBitSteps(store, scopeNames),
    useBitWatch: (path) => useBitWatch(store, path),
    useBitField: (path) => useBitField(store, path),
    useBitPersist: () => useBitPersist(store),
  };

  bindingCache.set(store as object, bindings);
  return bindings;
}

export function createBitReactNativeForm<
  TForm extends object = Record<string, unknown>,
>(config: BitConfig<TForm> = {}): BitReactNativeBindings<TForm> {
  const store = createBitStore<TForm>(config);
  return createBitReactNativeBindings(store);
}
