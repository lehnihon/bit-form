import { deepClone, deepEqual } from "../../../utils";
import {
  applyHistoryPatch,
  createHistoryPatch,
  type BitHistoryPatch,
} from "../../engines/snapshot-diff-engine";

export class BitHistoryManager<T extends object = Record<string, unknown>> {
  private baseSnapshot: T | null = null;
  private currentSnapshot: T | null = null;
  private patches: BitHistoryPatch<T>[] = [];
  private historyIndex = -1;
  private historySize = 0;

  constructor(
    private enableHistory: boolean,
    private maxHistory: number,
  ) {}

  saveSnapshot(values: T) {
    if (!this.enableHistory) return;

    if (!this.currentSnapshot || this.baseSnapshot === null) {
      this.reset(values);
      return;
    }

    if (deepEqual(this.currentSnapshot, values)) {
      return;
    }

    if (this.historyIndex < this.historySize - 1) {
      this.patches.splice(this.historyIndex);
      this.historySize = this.historyIndex + 1;
    }

    const patch = createHistoryPatch(this.currentSnapshot, values);
    if (patch.operations.length === 0) {
      return;
    }

    this.patches.push(patch);
    this.currentSnapshot = deepClone(values);
    this.historyIndex += 1;
    this.historySize = this.historyIndex + 1;

    while (this.historySize > this.getCapacity()) {
      this.compactOldestSnapshot();
    }
  }

  get canUndo(): boolean {
    return this.enableHistory ? this.historyIndex > 0 : false;
  }

  get canRedo(): boolean {
    return this.enableHistory
      ? this.historyIndex < this.historySize - 1
      : false;
  }

  undo(): T | null {
    if (!this.canUndo || !this.currentSnapshot) {
      return null;
    }

    const patch = this.patches[this.historyIndex - 1];
    const previousSnapshot = applyHistoryPatch(
      this.currentSnapshot,
      patch,
      "undo",
    );

    this.currentSnapshot = deepClone(previousSnapshot);
    this.historyIndex -= 1;
    return previousSnapshot;
  }

  redo(): T | null {
    if (!this.canRedo || !this.currentSnapshot) {
      return null;
    }

    const patch = this.patches[this.historyIndex];
    const nextSnapshot = applyHistoryPatch(this.currentSnapshot, patch, "redo");

    this.currentSnapshot = deepClone(nextSnapshot);
    this.historyIndex += 1;
    return nextSnapshot;
  }

  reset(initialValues: T) {
    if (!this.enableHistory) {
      this.baseSnapshot = null;
      this.currentSnapshot = null;
      this.patches = [];
      this.historyIndex = -1;
      this.historySize = 0;
      return;
    }

    this.baseSnapshot = deepClone(initialValues);
    this.currentSnapshot = deepClone(initialValues);
    this.patches = [];
    this.historyIndex = 0;
    this.historySize = 1;
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

  private compactOldestSnapshot() {
    const oldestPatch = this.patches.shift();
    if (!oldestPatch || this.baseSnapshot === null) {
      return;
    }

    this.baseSnapshot = applyHistoryPatch(
      this.baseSnapshot,
      oldestPatch,
      "redo",
    );
    this.historySize = Math.max(1, this.historySize - 1);
    this.historyIndex = Math.max(0, this.historyIndex - 1);
  }

  private getCapacity() {
    return Math.max(1, this.maxHistory);
  }
}
