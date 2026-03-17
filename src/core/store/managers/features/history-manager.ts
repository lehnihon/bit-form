import { deepClone, deepEqual } from "../../../utils";

export class BitHistoryManager<T extends object = any> {
  private history: Array<T | undefined> = [];
  private historyIndex: number = -1;
  private historySize = 0;
  private historyHead = 0;

  constructor(
    private enableHistory: boolean,
    private maxHistory: number = 15,
  ) {}

  saveSnapshot(values: T) {
    if (!this.enableHistory) return;

    const currentSnapshot = this.getSnapshotAt(this.historyIndex);

    if (currentSnapshot && deepEqual(currentSnapshot, values)) {
      return;
    }

    const snapshot = deepClone(values);
    const capacity = this.getCapacity();

    if (this.historyIndex < this.historySize - 1) {
      this.historySize = this.historyIndex + 1;
    }

    const nextIndex = this.historyIndex + 1;

    if (nextIndex < capacity) {
      this.history[this.toPhysicalIndex(nextIndex)] = snapshot;
      this.historySize = Math.max(this.historySize, nextIndex + 1);
      this.historyIndex = nextIndex;
    } else {
      this.historyHead = (this.historyHead + 1) % capacity;
      this.history[this.toPhysicalIndex(capacity - 1)] = snapshot;
      this.historySize = capacity;
      this.historyIndex = capacity - 1;
    }
  }

  get canUndo(): boolean {
    return this.enableHistory ? this.historyIndex > 0 : false;
  }

  /**
   * Usa historySize (lógico) e não history.length (físico).
   * Após undo + nova escrita, entries além de historySize ficam stale no array,
   * provocando canRedo=true incorreto e redo() devolvendo snapshot descartado.
   */
  get canRedo(): boolean {
    return this.enableHistory
      ? this.historyIndex < this.historySize - 1
      : false;
  }
  undo(): T | null {
    if (this.canUndo) {
      this.historyIndex--;
      return deepClone(this.getSnapshotAt(this.historyIndex)!);
    }
    return null;
  }

  redo(): T | null {
    if (this.canRedo) {
      this.historyIndex++;
      return deepClone(this.getSnapshotAt(this.historyIndex)!);
    }
    return null;
  }

  reset(initialValues: T) {
    this.history = [];
    this.historyIndex = -1;
    this.historySize = 0;
    this.historyHead = 0;
    this.saveSnapshot(initialValues);
  }

  getMetadata(): {
    enabled: boolean;
    canUndo: boolean;
    canRedo: boolean;
    historyIndex: number;
    historySize: number;
  } {
    return {
      enabled: this.enableHistory,
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      historyIndex: this.historyIndex,
      historySize: this.historySize,
    };
  }

  private getCapacity() {
    return Math.max(1, this.maxHistory);
  }

  private toPhysicalIndex(logicalIndex: number) {
    return (this.historyHead + logicalIndex) % this.getCapacity();
  }

  private getSnapshotAt(logicalIndex: number) {
    if (logicalIndex < 0 || logicalIndex >= this.historySize) {
      return undefined;
    }

    return this.history[this.toPhysicalIndex(logicalIndex)];
  }
}
