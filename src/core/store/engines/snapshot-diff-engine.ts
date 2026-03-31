import {
  deepClone,
  deepEqual,
  setDeepValues,
  unsetDeepValues,
} from "../../utils";

type HistoryDirection = "undo" | "redo";

export interface BitHistoryPatchOperation {
  path: string;
  previousValue: unknown;
  nextValue: unknown;
  hadPreviousValue: boolean;
  hasNextValue: boolean;
}

export interface BitHistoryPatch<T extends object> {
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

export function createHistoryPatch<T extends object>(
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

export function applyHistoryPatch<T extends object>(
  currentValue: T,
  patch: BitHistoryPatch<T>,
  direction: HistoryDirection,
): T {
  let nextValue: unknown = currentValue;
  const setUpdates: Array<readonly [string, unknown]> = [];
  const unsetPaths: string[] = [];

  for (const operation of patch.operations) {
    const shouldSet =
      direction === "undo"
        ? operation.hadPreviousValue
        : operation.hasNextValue;
    const value =
      direction === "undo" ? operation.previousValue : operation.nextValue;

    if (!operation.path) {
      nextValue = shouldSet ? value : {};
      setUpdates.length = 0;
      unsetPaths.length = 0;
      continue;
    }

    if (shouldSet) {
      setUpdates.push([operation.path, value]);
      continue;
    }

    unsetPaths.push(operation.path);
  }

  if (setUpdates.length > 0) {
    nextValue = setDeepValues(nextValue, setUpdates);
  }

  if (unsetPaths.length > 0) {
    nextValue = unsetDeepValues(nextValue, unsetPaths);
  }

  return nextValue as T;
}
