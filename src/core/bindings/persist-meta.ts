import type { BitPersistMetadata } from "../public-types";

export function readPersistMetaSnapshot(store: {
  getPersistMetadata(): BitPersistMetadata;
}): BitPersistMetadata {
  return store.getPersistMetadata();
}

export function subscribePersistMetaSnapshot(
  store: {
    subscribePersistMeta(
      listener: (meta: BitPersistMetadata) => void,
    ): () => void;
  },
  listener: () => void,
): () => void {
  return store.subscribePersistMeta(() => listener());
}

export function observePersistMetaSnapshot(
  store: {
    getPersistMetadata(): BitPersistMetadata;
    subscribePersistMeta(
      listener: (meta: BitPersistMetadata) => void,
    ): () => void;
  },
  listener: (meta: BitPersistMetadata) => void,
): () => void {
  listener(readPersistMetaSnapshot(store));

  return store.subscribePersistMeta((meta) => {
    listener(meta);
  });
}
