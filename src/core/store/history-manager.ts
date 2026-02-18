import { deepClone, deepEqual } from "./utils";

export class BitHistoryManager<T extends object = any> {
  private history: T[] = [];
  private historyIndex: number = -1;

  constructor(
    private enableHistory: boolean,
    private maxHistory: number = 15,
  ) {}

  saveSnapshot(values: T) {
    if (!this.enableHistory) return;

    const currentSnapshot = this.history[this.historyIndex];

    if (currentSnapshot && deepEqual(currentSnapshot, values)) {
      return;
    }

    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(deepClone(values));

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  get canUndo(): boolean {
    return this.enableHistory ? this.historyIndex > 0 : false;
  }

  get canRedo(): boolean {
    return this.enableHistory
      ? this.historyIndex < this.history.length - 1
      : false;
  }

  undo(): T | null {
    if (this.canUndo) {
      this.historyIndex--;
      return deepClone(this.history[this.historyIndex]);
    }
    return null;
  }

  redo(): T | null {
    if (this.canRedo) {
      this.historyIndex++;
      return deepClone(this.history[this.historyIndex]);
    }
    return null;
  }

  reset(initialValues: T) {
    this.history = [];
    this.historyIndex = -1;
    this.saveSnapshot(initialValues);
  }
}
