import type { BitConfig, BitFrameworkStoreApi, BitStoreApi } from "../core";
import { createBitStore } from "../core";
import { injectBitArray } from "./inject-bit-array";
import { injectBitField } from "./inject-bit-field";
import { injectBitForm } from "./inject-bit-form";
import { injectBitHistory } from "./inject-bit-history";
import { injectBitPersist } from "./inject-bit-persist";
import { injectBitScope } from "./inject-bit-scope";
import { injectBitSteps } from "./inject-bit-steps";
import { injectBitUpload } from "./inject-bit-upload";
import { injectBitWatch } from "./inject-bit-watch";
import { resolveAngularStore } from "./store";

export interface BitAngularBindings<TForm extends object = any> {
  injectBitForm: () => ReturnType<typeof injectBitForm<TForm>>;
  injectBitField: <P extends import("../core").BitPath<TForm>>(
    path: P,
  ) => ReturnType<typeof injectBitField<any, TForm, P>>;
  injectBitArray: <P extends import("../core").BitArrayPath<TForm>>(
    path: P,
  ) => ReturnType<typeof injectBitArray<TForm, P>>;
  injectBitHistory: () => ReturnType<typeof injectBitHistory<TForm>>;
  injectBitScope: (
    scopeName: string,
  ) => ReturnType<typeof injectBitScope<TForm>>;
  injectBitSteps: (
    scopeNames: string[],
  ) => ReturnType<typeof injectBitSteps<TForm>>;
  injectBitWatch: <P extends import("../core").BitPath<TForm>>(
    path: P,
  ) => ReturnType<typeof injectBitWatch<TForm, P>>;
  injectBitUpload: <
    TMetadata extends Record<string, unknown> = Record<string, unknown>,
  >(
    fieldPath: string,
    uploadFn: import("../core").BitUploadFn<TMetadata>,
    deleteFile?: import("../core").BitDeleteUploadFn,
  ) => ReturnType<typeof injectBitUpload<TForm, TMetadata>>;
  injectBitPersist: () => ReturnType<typeof injectBitPersist<TForm>>;
}

const bindingCache = new WeakMap<object, BitAngularBindings<any>>();

function buildBindings<TForm extends object>(
  store: BitFrameworkStoreApi<TForm>,
): BitAngularBindings<TForm> {
  return {
    injectBitForm: () => injectBitForm(store),
    injectBitField: (path) => injectBitField(store, path),
    injectBitArray: (path) => injectBitArray(store, path),
    injectBitHistory: () => injectBitHistory(store),
    injectBitScope: (scopeName) => injectBitScope(store, scopeName),
    injectBitSteps: (scopeNames) => injectBitSteps(store, scopeNames),
    injectBitWatch: (path) => injectBitWatch(store, path),
    injectBitUpload: (fieldPath, uploadFn, deleteFile) =>
      injectBitUpload(store, fieldPath, uploadFn, deleteFile),
    injectBitPersist: () => injectBitPersist(store),
  };
}

export function createBitAngularBindings<TForm extends object>(
  storeInput: BitFrameworkStoreApi<TForm> | BitStoreApi<TForm>,
): BitAngularBindings<TForm> {
  const store = resolveAngularStore(storeInput);
  const cached = bindingCache.get(store as object) as
    | BitAngularBindings<TForm>
    | undefined;
  if (cached) {
    return cached;
  }

  const bindings = buildBindings(store);
  bindingCache.set(store as object, bindings);
  return bindings;
}

export function createBitAngularForm<
  TForm extends object = Record<string, unknown>,
>(config: BitConfig<TForm> = {}): BitAngularBindings<TForm> {
  const store = createBitStore<TForm>(config);
  return createBitAngularBindings(store);
}
