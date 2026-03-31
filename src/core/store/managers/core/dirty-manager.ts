import {
  collectDirtyPaths,
  getDeepValue,
  setDeepValues,
  valueEqual,
} from "../../../utils";

/**
 * BitDirtyManager
 *
 * Manages dirty state tracking for form fields.
 * Tracks which fields have been modified from their initial values.
 */
export class BitDirtyManager<T extends object = Record<string, unknown>> {
  private dirtyPaths: Set<string> = new Set();
  private dirtyPathIndex: Set<string> = new Set();
  private dirtyPrefixRefCount: Map<string, number> = new Map();
  /** Maps each strict ancestor prefix → set of dirty paths that are its descendants. */
  private childrenByPrefix: Map<string, Set<string>> = new Map();

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
    this.childrenByPrefix.clear();
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
    // Check if exact path is dirty
    if (this.dirtyPathIndex.has(path)) {
      return true;
    }

    // Check if any ancestor prefix is dirty using refcount (O(1) instead of O(depth))
    let separatorIndex = path.lastIndexOf(".");
    while (separatorIndex > -1) {
      const ancestorPath = path.slice(0, separatorIndex);
      if ((this.dirtyPrefixRefCount.get(ancestorPath) ?? 0) > 0) {
        return true;
      }
      separatorIndex = path.lastIndexOf(".", separatorIndex - 1);
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

    const updates: Array<readonly [string, unknown]> = [];
    const sortedPaths = [...this.dirtyPaths].sort();
    const processedArrays = new Set<string>();
    const includedPaths: string[] = [];

    const isDescendantOfIncludedPath = (path: string) => {
      for (const parentPath of includedPaths) {
        if (path.startsWith(`${parentPath}.`)) {
          return true;
        }
      }

      return false;
    };

    for (const path of sortedPaths) {
      if (isDescendantOfIncludedPath(path)) {
        continue;
      }

      const arrayMatch = path.match(/^(.+)\.\d+/);

      if (arrayMatch) {
        const arrayPath = arrayMatch[1];
        if (processedArrays.has(arrayPath)) continue;
        processedArrays.add(arrayPath);
        const arrayVal = getDeepValue(values, arrayPath);
        updates.push([arrayPath, arrayVal]);
        includedPaths.push(arrayPath);
      } else {
        const fieldVal = getDeepValue(values, path);
        updates.push([path, fieldVal]);
        includedPaths.push(path);
      }
    }

    if (updates.length === 0) {
      return {};
    }

    return setDeepValues({}, updates) as Partial<T>;
  }

  private rebuildIndex() {
    const nextIndex = new Set<string>();
    const nextRefCount = new Map<string, number>();
    const nextChildrenByPrefix = new Map<string, Set<string>>();

    for (const dirtyPath of this.dirtyPaths) {
      this.forEachPathPrefix(dirtyPath, (prefix) => {
        nextIndex.add(prefix);
        nextRefCount.set(prefix, (nextRefCount.get(prefix) ?? 0) + 1);
      });

      this.forEachAncestorPrefix(dirtyPath, (ancestor) => {
        const set = nextChildrenByPrefix.get(ancestor);
        if (set) {
          set.add(dirtyPath);
        } else {
          nextChildrenByPrefix.set(ancestor, new Set([dirtyPath]));
        }
      });
    }

    this.dirtyPathIndex = nextIndex;
    this.dirtyPrefixRefCount = nextRefCount;
    this.childrenByPrefix = nextChildrenByPrefix;
  }

  private removeDirtyChildren(parentPath: string) {
    const children = this.childrenByPrefix.get(parentPath);
    if (!children || children.size === 0) return;

    // Snapshot to avoid mutating the set while iterating
    for (const path of [...children]) {
      this.removeDirtyPath(path);
    }
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

    // Keep childrenByPrefix up to date for O(1) removeDirtyChildren
    this.forEachAncestorPrefix(path, (ancestor) => {
      const set = this.childrenByPrefix.get(ancestor);
      if (set) {
        set.add(path);
      } else {
        this.childrenByPrefix.set(ancestor, new Set([path]));
      }
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

    // Remove from childrenByPrefix
    this.forEachAncestorPrefix(path, (ancestor) => {
      this.childrenByPrefix.get(ancestor)?.delete(path);
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

  /**
   * Iterates over all strict ancestor prefixes of `path` (i.e., excludes the path itself).
   * Used to maintain childrenByPrefix.
   */
  private forEachAncestorPrefix(
    path: string,
    callback: (prefix: string) => void,
  ) {
    const segments = path.split(".");
    let current = "";

    for (let i = 0; i < segments.length - 1; i++) {
      current = current ? `${current}.${segments[i]}` : segments[i];
      callback(current);
    }
  }
}
