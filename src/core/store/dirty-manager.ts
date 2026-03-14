import {
  collectDirtyPaths,
  getDeepValue,
  setDeepValue,
  valueEqual,
} from "../utils";

/**
 * BitDirtyManager
 *
 * Manages dirty state tracking for form fields.
 * Tracks which fields have been modified from their initial values.
 */
export class BitDirtyManager<T extends object = any> {
  private dirtyPaths: Set<string> = new Set();

  /**
   * Updates dirty state for a single path change.
   * Automatically removes child paths when parent changes.
   * @returns true if any fields are dirty
   */
  updateForPath(path: string, values: T, initialValues: T): boolean {
    // Remove child paths when parent changes
    for (const p of this.dirtyPaths) {
      if (p.startsWith(path + ".")) {
        this.dirtyPaths.delete(p);
      }
    }

    const current = getDeepValue(values, path);
    const initial = getDeepValue(initialValues, path);

    if (valueEqual(current, initial)) {
      this.dirtyPaths.delete(path);
    } else {
      this.dirtyPaths.add(path);
    }

    return this.dirtyPaths.size > 0;
  }

  /**
   * Rebuilds dirty paths from full state comparison.
   * Used for undo/redo and bulk updates.
   * @returns true if any fields are dirty
   */
  rebuild(values: T, initialValues: T): boolean {
    this.dirtyPaths = collectDirtyPaths(values, initialValues);
    return this.dirtyPaths.size > 0;
  }

  /**
   * Clears all dirty tracking.
   * Used when resetting form or updating initial values.
   */
  clear(): void {
    this.dirtyPaths.clear();
  }

  /**
   * Returns current dirty state.
   */
  get isDirty(): boolean {
    return this.dirtyPaths.size > 0;
  }

  /**
   * Returns readonly set of dirty paths (for debugging/devtools).
   */
  getDirtyPaths(): ReadonlySet<string> {
    return this.dirtyPaths;
  }

  /**
   * Builds a partial object containing only dirty values.
   * For arrays, returns the entire array if any index changed.
   * @param values - current form values (already cleaned/transformed)
   */
  buildDirtyValues<T extends object>(values: T): Partial<T> {
    if (this.dirtyPaths.size === 0) return {};

    let result: any = {};
    const processedArrays = new Set<string>();

    for (const path of this.dirtyPaths) {
      const arrayMatch = path.match(/^(.+)\.\d+/);

      if (arrayMatch) {
        const arrayPath = arrayMatch[1];
        if (processedArrays.has(arrayPath)) continue;
        processedArrays.add(arrayPath);
        const arrayVal = getDeepValue(values, arrayPath);
        result = setDeepValue(result, arrayPath, arrayVal);
      } else {
        const fieldVal = getDeepValue(values, path);
        result = setDeepValue(result, path, fieldVal);
      }
    }

    return result;
  }
}
