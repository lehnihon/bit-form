import type { BitPersistMetadata } from "../store/contracts/types";

type BitPersistMetaReadableStore = {
  read: {
    getPersistMetadata(): BitPersistMetadata;
  };
  observe: {
    subscribePersistMeta(
      listener: (meta: BitPersistMetadata) => void,
    ): () => void;
  };
};

export function readPersistMetaSnapshot(store: {
  read: {
    getPersistMetadata(): BitPersistMetadata;
  };
}): BitPersistMetadata {
  return store.read.getPersistMetadata();
}

export function subscribePersistMetaSnapshot(
  store: BitPersistMetaReadableStore,
  listener: () => void,
): () => void {
  return store.observe.subscribePersistMeta(() => listener());
}

export function observePersistMetaSnapshot(
  store: BitPersistMetaReadableStore,
  listener: (meta: BitPersistMetadata) => void,
): () => void {
  listener(readPersistMetaSnapshot(store));

  return store.observe.subscribePersistMeta((meta) => {
    listener(meta);
  });
}
