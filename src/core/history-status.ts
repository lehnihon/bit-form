import type { BitHistoryMetadata } from "./store/contracts/public-types";

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
