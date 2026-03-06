import { collectDirtyPaths, getDeepValue, valueEqual } from "../utils";

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

    const result: any = {};
    const processedArrays = new Set<string>();

    for (const path of this.dirtyPaths) {
      // Check if this path is part of an array
      const arrayMatch = path.match(/^(.+)\.(\d+)/);
      
      if (arrayMatch) {
        const arrayPath = arrayMatch[1];
        
        // Skip if we already processed this array
        if (processedArrays.has(arrayPath)) continue;
        
        processedArrays.add(arrayPath);
        this.setNestedValue(result, arrayPath, this.getNestedValue(values, arrayPath));
      } else {
        // Regular field or array reference itself
        this.setNestedValue(result, path, this.getNestedValue(values, path));
      }
    }

    return result;
  }

  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current === null || current === undefined) return undefined;
      current = current[key];
    }
    return current;
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }
}
