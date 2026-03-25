import type { BitFormMeta } from "../store/contracts/public/meta-types";
import type { BitFormMetaBindingApi } from "../store/contracts/public/store-api-types";

export function readFormMetaSnapshot<T extends object>(
  store: BitFormMetaBindingApi<T>,
): BitFormMeta {
  const state = store.getState();
  return {
    isValid: state.isValid,
    isDirty: state.isDirty,
    isSubmitting: state.isSubmitting,
  };
}

export function subscribeFormMetaSnapshot<T extends object>(
  store: BitFormMetaBindingApi<T>,
  listener: () => void,
): () => void {
  return store.subscribeFormMeta(() => listener());
}

export function observeFormMetaSnapshot<T extends object>(
  store: BitFormMetaBindingApi<T>,
  listener: (meta: BitFormMeta) => void,
): () => void {
  listener(readFormMetaSnapshot(store));

  return subscribeFormMetaSnapshot(store, () => {
    listener(readFormMetaSnapshot(store));
  });
}
