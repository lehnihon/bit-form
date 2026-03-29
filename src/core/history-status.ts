import type { BitHistoryMetadata } from "./store/contracts/public/meta-types";

/**
 * Subconjunto relevante de BitHistoryMetadata para comparação de igualdade.
 * Evita re-renders/updates desnecessários quando o estado de histórico não muda.
 */
export type HistoryMeta = Pick<
  BitHistoryMetadata,
  "canUndo" | "canRedo" | "historyIndex" | "historySize"
>;

/**
 * Compara dois snapshots de metadata de histórico por valor.
 * Retorna `true` quando todos os campos relevantes são idênticos,
 * permitindo que os bindings de framework ignorem atualizações não relacionadas.
 */
export function isHistoryMetaEqual(a: HistoryMeta, b: HistoryMeta): boolean {
  return (
    a.canUndo === b.canUndo &&
    a.canRedo === b.canRedo &&
    a.historyIndex === b.historyIndex &&
    a.historySize === b.historySize
  );
}

export function readHistoryMetaSnapshot<T extends object>(store: {
  read: {
    getHistoryMetadata(): BitHistoryMetadata;
  };
}): HistoryMeta {
  const nextMeta = store.read.getHistoryMetadata();

  return {
    canUndo: nextMeta.canUndo,
    canRedo: nextMeta.canRedo,
    historyIndex: nextMeta.historyIndex,
    historySize: nextMeta.historySize,
  };
}

export function observeHistoryMetaSnapshot<T extends object>(
  store: {
    read: {
      getHistoryMetadata(): BitHistoryMetadata;
    };
    observe: {
      subscribeHistoryMeta(
        listener: (meta: BitHistoryMetadata) => void,
      ): () => void;
    };
  },
  listener: (meta: HistoryMeta) => void,
): () => void {
  listener(readHistoryMetaSnapshot(store));

  return store.observe.subscribeHistoryMeta(() => {
    listener(readHistoryMetaSnapshot(store));
  });
}

export function getHistorySubscriptionPath() {
  return "__history__";
}
