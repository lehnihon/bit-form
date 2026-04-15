import type { BitHistoryManager } from "../managers/features/history-manager";

type BitHistoryMetadataSnapshot = {
  canUndo: boolean;
  canRedo: boolean;
  historyIndex: number;
  historySize: number;
};

interface BitStoreHistoryOrchestratorArgs<T extends object> {
  debounceMs?: number;
  history: Pick<BitHistoryManager<T>, "saveSnapshot" | "getMetadata">;
  notifyHistoryChanged: () => void;
}

export class BitStoreHistoryOrchestrator<T extends object> {
  private readonly debounceMs: number;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pendingValues: T | null = null;

  constructor(private readonly args: BitStoreHistoryOrchestratorArgs<T>) {
    this.debounceMs = Math.max(0, args.debounceMs ?? 300);
  }

  queueSnapshot(values: T): void {
    if (this.debounceMs <= 0) {
      this.recordSnapshot(values);
      return;
    }

    this.pendingValues = values;

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.flushPendingSnapshot();
    }, this.debounceMs);
  }

  flushPendingSnapshot(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    if (!this.pendingValues) {
      return;
    }

    const values = this.pendingValues;
    this.pendingValues = null;
    this.recordSnapshot(values);
  }

  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    this.pendingValues = null;
  }

  private recordSnapshot(values: T): void {
    const before = this.readMetadata();
    this.args.history.saveSnapshot(values);
    const after = this.readMetadata();

    if (
      before.canUndo === after.canUndo &&
      before.canRedo === after.canRedo &&
      before.historyIndex === after.historyIndex &&
      before.historySize === after.historySize
    ) {
      return;
    }

    this.args.notifyHistoryChanged();
  }

  private readMetadata(): BitHistoryMetadataSnapshot {
    const metadata = this.args.history.getMetadata();
    return {
      canUndo: metadata.canUndo,
      canRedo: metadata.canRedo,
      historyIndex: metadata.historyIndex,
      historySize: metadata.historySize,
    };
  }
}
