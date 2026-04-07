import type { BitConfig, BitFrameworkStoreApi, BitStoreApi } from "../core";
import { createBitStore } from "../core";
import { resolveReactStore } from "./store";
import { useBitArray } from "./use-bit-array";
import { useBitField } from "./use-bit-field";
import { useBitForm } from "./use-bit-form";
import { useBitHistory } from "./use-bit-history";
import { useBitPersist } from "./use-bit-persist";
import { useBitScope } from "./use-bit-scope";
import { useBitSteps } from "./use-bit-steps";
import { useBitUpload } from "./use-bit-upload";
import { useBitWatch } from "./use-bit-watch";

type AnyStore = BitFrameworkStoreApi<any> | BitStoreApi<any>;

export interface BitReactBindings<TForm extends object = any> {
  useBitForm: () => ReturnType<typeof useBitForm<TForm>>;
  useBitField: <P extends import("../core").BitPath<TForm>>(
    path: P,
  ) => ReturnType<typeof useBitField<TForm, P>>;
  useBitArray: <P extends import("../core").BitArrayPath<TForm>>(
    path: P,
  ) => ReturnType<typeof useBitArray<TForm, P>>;
  useBitHistory: () => ReturnType<typeof useBitHistory<TForm>>;
  useBitScope: (scopeName: string) => ReturnType<typeof useBitScope<TForm>>;
  useBitSteps: (scopeNames: string[]) => ReturnType<typeof useBitSteps<TForm>>;
  useBitWatch: <P extends import("../core").BitPath<TForm>>(
    path: P,
  ) => ReturnType<typeof useBitWatch<TForm, P>>;
  useBitUpload: <
    TMetadata extends Record<string, unknown> = Record<string, unknown>,
  >(
    fieldPath: string,
    uploadFn: import("../core").BitUploadFn<TMetadata>,
    deleteFile?: import("../core").BitDeleteUploadFn,
  ) => ReturnType<typeof useBitUpload<TForm, TMetadata>>;
  useBitPersist: () => ReturnType<typeof useBitPersist<TForm>>;
}

const bindingCache = new WeakMap<object, BitReactBindings<any>>();

function buildBindings<TForm extends object>(
  store: BitFrameworkStoreApi<TForm>,
): BitReactBindings<TForm> {
  return {
    useBitForm: () => useBitForm(store),
    useBitField: (path) => useBitField(store, path),
    useBitArray: (path) => useBitArray(store, path),
    useBitHistory: () => useBitHistory(store),
    useBitScope: (scopeName) => useBitScope(store, scopeName),
    useBitSteps: (scopeNames) => useBitSteps(store, scopeNames),
    useBitWatch: (path) => useBitWatch(store, path),
    useBitUpload: (fieldPath, uploadFn, deleteFile) =>
      useBitUpload(store, fieldPath, uploadFn, deleteFile),
    useBitPersist: () => useBitPersist(store),
  };
}

export function createBitReactBindings<TForm extends object>(
  storeInput: BitFrameworkStoreApi<TForm> | BitStoreApi<TForm>,
): BitReactBindings<TForm> {
  const store = resolveReactStore(storeInput);
  const cached = bindingCache.get(store as object) as
    | BitReactBindings<TForm>
    | undefined;
  if (cached) {
    return cached;
  }

  const bindings = buildBindings(store);
  bindingCache.set(store as object, bindings);
  return bindings;
}

export function createBitReactForm<
  TForm extends object = Record<string, unknown>,
>(config: BitConfig<TForm> = {}): BitReactBindings<TForm> {
  const store = createBitStore<TForm>(config);
  return createBitReactBindings(store);
}
