import type { BitFormMeta, BitFormMetaBindingApi } from "../public-types";

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
