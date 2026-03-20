import { BitState } from "../../contracts/types";
import { BitFieldRegistry } from "../../registry/field-registry";

/**
 * BitFieldQueryManager
 *
 * Provides query methods for field state without mutating.
 * All methods are read-only and delegate to appropriate managers.
 */
export class BitFieldQueryManager<T extends object = any> {
  private requiredValuesRef: T | null = null;

  constructor(
    private fieldRegistry: BitFieldRegistry<T>,
    private getState: () => BitState<T>,
    private isPathDirty: (path: string) => boolean,
  ) {}

  /**
   * Check if a field is hidden based on conditional logic.
   */
  isHidden<P extends string>(path: P): boolean {
    return this.fieldRegistry.isHidden(path);
  }

  /**
   * Check if a field is required based on conditional logic.
   */
  isRequired<P extends string>(path: P): boolean {
    const values = this.getState().values;

    if (this.requiredValuesRef !== values) {
      this.requiredValuesRef = values;
    }

    return this.fieldRegistry.isRequired(path, values);
  }

  /**
   * Check if a field has been modified from its initial value.
   */
  isFieldDirty(path: string): boolean {
    return this.isPathDirty(path);
  }

  /**
   * Check if a field is currently validating (async validation in progress).
   */
  isFieldValidating(path: string): boolean {
    return !!this.getState().isValidating[path];
  }

  isTouched(path: string): boolean {
    return !!this.getState().touched[path];
  }
}
