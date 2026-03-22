import type {
  BitFormMeta,
  BitFormMetaBindingApi,
} from "../store/contracts/public-types";
import { resolveSegmentedBinding } from "../store/segmented-binding";

export function readFormMetaSnapshot<T extends object>(
  store: BitFormMetaBindingApi<T>,
): BitFormMeta {
  const segmented = resolveSegmentedBinding(store as any);
  const state = segmented.query.getState();
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
  const segmented = resolveSegmentedBinding(store as any);
  return segmented.observe.subscribeFormMeta(() => listener());
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
