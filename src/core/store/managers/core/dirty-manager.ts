import {
  collectDirtyPaths,
  getDeepValue,
  setDeepValue,
  valueEqual,
} from "../../../utils";

/**
 * BitDirtyManager
 *
 * Manages dirty state tracking for form fields.
 * Tracks which fields have been modified from their initial values.
 */
export class BitDirtyManager<T extends object = any> {
  private dirtyPaths: Set<string> = new Set();
  private dirtyPathIndex: Set<string> = new Set();
  private dirtyPrefixRefCount: Map<string, number> = new Map();

  /**
   * Updates dirty state for a single path change.
   * Automatically removes child paths when parent changes.
   * @returns true if any fields are dirty
   */
  updateForPath(path: string, values: T, initialValues: T): boolean {
    this.removeDirtyChildren(path);

    const current = getDeepValue(values, path);
    const initial = getDeepValue(initialValues, path);

    if (valueEqual(current, initial)) {
      this.removeDirtyPath(path);
    } else {
      this.addDirtyPath(path);
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
    this.dirtyPrefixRefCount.clear();
    this.rebuildIndex();
    return this.dirtyPaths.size > 0;
  }

  /**
   * Clears all dirty tracking.
   * Used when resetting form or updating initial values.
   */
  clear(): void {
    this.dirtyPaths.clear();
    this.dirtyPathIndex.clear();
    this.dirtyPrefixRefCount.clear();
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

  isPathDirty(path: string): boolean {
    if (this.dirtyPathIndex.has(path)) {
      return true;
    }

    const segments = path.split(".");
    while (segments.length > 1) {
      segments.pop();
      if (this.dirtyPaths.has(segments.join("."))) {
        return true;
      }
    }

    return false;
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

  private rebuildIndex() {
    const nextIndex = new Set<string>();
    const nextRefCount = new Map<string, number>();

    for (const dirtyPath of this.dirtyPaths) {
      this.forEachPathPrefix(dirtyPath, (prefix) => {
        nextIndex.add(prefix);
        nextRefCount.set(prefix, (nextRefCount.get(prefix) ?? 0) + 1);
      });
    }

    this.dirtyPathIndex = nextIndex;
    this.dirtyPrefixRefCount = nextRefCount;
  }

  private removeDirtyChildren(parentPath: string) {
    const childrenToRemove: string[] = [];

    for (const dirtyPath of this.dirtyPaths) {
      if (dirtyPath.startsWith(`${parentPath}.`)) {
        childrenToRemove.push(dirtyPath);
      }
    }

    childrenToRemove.forEach((path) => this.removeDirtyPath(path));
  }

  private addDirtyPath(path: string) {
    if (this.dirtyPaths.has(path)) {
      return;
    }

    this.dirtyPaths.add(path);
    this.forEachPathPrefix(path, (prefix) => {
      this.dirtyPathIndex.add(prefix);
      this.dirtyPrefixRefCount.set(
        prefix,
        (this.dirtyPrefixRefCount.get(prefix) ?? 0) + 1,
      );
    });
  }

  private removeDirtyPath(path: string) {
    if (!this.dirtyPaths.has(path)) {
      return;
    }

    this.dirtyPaths.delete(path);

    this.forEachPathPrefix(path, (prefix) => {
      const nextCount = (this.dirtyPrefixRefCount.get(prefix) ?? 0) - 1;

      if (nextCount <= 0) {
        this.dirtyPrefixRefCount.delete(prefix);
        this.dirtyPathIndex.delete(prefix);
        return;
      }

      this.dirtyPrefixRefCount.set(prefix, nextCount);
    });
  }

  private forEachPathPrefix(path: string, callback: (prefix: string) => void) {
    const segments = path.split(".");
    let current = "";

    for (const segment of segments) {
      current = current ? `${current}.${segment}` : segment;
      callback(current);
    }
  }
}
