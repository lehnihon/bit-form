import type { BitPersistMetadata } from "../store/contracts/types";
import type { BitStoreApi } from "../store/contracts/public/store-api-types";

export function readPersistMetaSnapshot(store: {
  read: {
    getPersistMetadata(): BitPersistMetadata;
  };
}): BitPersistMetadata {
  return store.read.getPersistMetadata();
}

export function subscribePersistMetaSnapshot(
  store: BitStoreApi<any>,
  listener: () => void,
): () => void {
  return store.observe.subscribePersistMeta(() => listener());
}

export function observePersistMetaSnapshot(
  store: BitStoreApi<any>,
  listener: (meta: BitPersistMetadata) => void,
): () => void {
  listener(readPersistMetaSnapshot(store));

  return store.observe.subscribePersistMeta((meta) => {
    listener(meta);
  });
}
