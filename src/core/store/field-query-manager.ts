import { BitResolvedConfig, BitState } from "./types";
import { BitDependencyManager } from "./dependency-manager";
import { getDeepValue, valueEqual } from "../utils";

/**
 * BitFieldQueryManager
 *
 * Provides query methods for field state without mutating.
 * All methods are read-only and delegate to appropriate managers.
 */
export class BitFieldQueryManager<T extends object = any> {
  constructor(
    private depsMg: BitDependencyManager<T>,
    private getState: () => BitState<T>,
    private getConfig: () => BitResolvedConfig<T>,
  ) {}

  /**
   * Check if a field is hidden based on conditional logic.
   */
  isHidden<P extends string>(path: P): boolean {
    return this.depsMg.isHidden(path);
  }

  /**
   * Check if a field is required based on conditional logic.
   */
  isRequired<P extends string>(path: P): boolean {
    return this.depsMg.isRequired(path, this.getState().values);
  }

  /**
   * Check if a field has been modified from its initial value.
   */
  isFieldDirty(path: string): boolean {
    const currentValue = getDeepValue(this.getState().values, path);
    const initialValue = getDeepValue(this.getConfig().initialValues, path);
    return !valueEqual(currentValue, initialValue);
  }

  /**
   * Check if a field is currently validating (async validation in progress).
   */
  isFieldValidating(path: string): boolean {
    return !!this.getState().isValidating[path];
  }
}
