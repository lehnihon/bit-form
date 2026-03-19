import {
  deepClone,
  deepEqual,
  setDeepValue,
  unsetDeepValue,
} from "../../../utils";

type HistoryDirection = "undo" | "redo";

interface BitHistoryPatchOperation {
  path: string;
  previousValue: unknown;
  nextValue: unknown;
  hadPreviousValue: boolean;
  hasNextValue: boolean;
}

interface BitHistoryPatch<T extends object> {
  operations: BitHistoryPatchOperation[];
  _type?: T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof RegExp)
  );
}

function createHistoryPatch<T extends object>(
  previousValue: T,
  nextValue: T,
): BitHistoryPatch<T> {
  const operations: BitHistoryPatchOperation[] = [];

  const visit = (
    previousNode: unknown,
    nextNode: unknown,
    path: string,
    hadPreviousValue: boolean,
    hasNextValue: boolean,
  ) => {
    if (hadPreviousValue && hasNextValue && deepEqual(previousNode, nextNode)) {
      return;
    }

    if (
      isPlainObject(previousNode) &&
      isPlainObject(nextNode) &&
      hadPreviousValue &&
      hasNextValue
    ) {
      const keys = new Set<string>([
        ...Object.keys(previousNode),
        ...Object.keys(nextNode),
      ]);

      for (const key of keys) {
        const childPath = path ? `${path}.${key}` : key;
        const childHasPrevious = Object.prototype.hasOwnProperty.call(
          previousNode,
          key,
        );
        const childHasNext = Object.prototype.hasOwnProperty.call(
          nextNode,
          key,
        );

        visit(
          previousNode[key],
          nextNode[key],
          childPath,
          childHasPrevious,
          childHasNext,
        );
      }
      return;
    }

    operations.push({
      path,
      previousValue: deepClone(previousNode),
      nextValue: deepClone(nextNode),
      hadPreviousValue,
      hasNextValue,
    });
  };

  visit(previousValue, nextValue, "", true, true);

  return {
    operations,
  };
}

function applyHistoryPatch<T extends object>(
  currentValue: T,
  patch: BitHistoryPatch<T>,
  direction: HistoryDirection,
): T {
  let nextValue: unknown = currentValue;

  for (const operation of patch.operations) {
    const shouldSet =
      direction === "undo"
        ? operation.hadPreviousValue
        : operation.hasNextValue;
    const value =
      direction === "undo" ? operation.previousValue : operation.nextValue;

    if (!operation.path) {
      nextValue = shouldSet ? deepClone(value) : {};
      continue;
    }

    nextValue = shouldSet
      ? setDeepValue(nextValue, operation.path, deepClone(value))
      : unsetDeepValue(nextValue, operation.path);
  }

  return nextValue as T;
}

export class BitHistoryManager<T extends object = any> {
  private baseSnapshot: T | null = null;
  private currentSnapshot: T | null = null;
  private patches: BitHistoryPatch<T>[] = [];
  private historyIndex = -1;
  private historySize = 0;

  constructor(
    private enableHistory: boolean,
    private maxHistory: number = 15,
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
