import type { BitFormMeta } from "../store/contracts/public/meta-types";
import type { BitStoreApi } from "../store/contracts/public/store-api-types";

export function readFormMetaSnapshot<T extends object>(
  store: BitStoreApi<T>,
): BitFormMeta {
  const state = store.read.getState();
  return {
    isValid: state.isValid,
    isDirty: state.isDirty,
    isSubmitting: state.isSubmitting,
  };
}

export function subscribeFormMetaSnapshot<T extends object>(
  store: BitStoreApi<T>,
  listener: () => void,
): () => void {
  return store.observe.subscribeFormMeta(() => listener());
}

export function observeFormMetaSnapshot<T extends object>(
  store: BitStoreApi<T>,
  listener: (meta: BitFormMeta) => void,
): () => void {
  listener(readFormMetaSnapshot(store));

  return subscribeFormMetaSnapshot(store, () => {
    listener(readFormMetaSnapshot(store));
  });
}
