import type { BitFieldDefinition, BitTransformFn } from "../contracts/types";
import type { BitDependencyUpdateDiff } from "../contracts/port-types";
import type { BitComputedEntry } from "../managers/core/computed-manager";
import type { BitNormalizerEntry } from "./field-catalog";

/**
 * Abstracts read-only access to field metadata.
 * Decouples managers from BitFieldRegistry implementation details.
 *
 * This interface defines the contract for accessing field configuration,
 * computed entries, transformations, and conditional logic without
 * exposing mutation operations (register/unregister/invalidate).
 */
export interface BitFieldMetadataProvider<
  T extends object = Record<string, unknown>,
> {
  /**
   * Get field configuration by path
   */
  getFieldConfig(path: string): BitFieldDefinition<T> | undefined;

  /**
   * Iterate over all registered field configurations
   */
  forEachFieldConfig(
    callback: (config: BitFieldDefinition<T>, path: string) => void,
  ): void;

  /**
   * Check if a field configuration exists
   */
  hasFieldConfig(path: string): boolean;

  /**
   * Get all computed field entries
   */
  getComputedEntries(): BitComputedEntry<T>[];

  /**
   * Get all field transform entries (applied during setField)
   */
  getTransformEntries(): [string, BitTransformFn<T>][];

  /**
   * Get all field normalizer entries (applied post-batch)
   */
  getNormalizerEntries(): BitNormalizerEntry<T>[];

  /**
   * Get fields that belong to a specific scope
   */
  getScopeFields(scopeName: string): string[];

  /**
   * Check if a field is hidden based on conditional logic
   */
  isHidden(path: string): boolean;

  /**
   * Check if a field is required based on conditional logic
   */
  isRequired(path: string, values: T): boolean;

  /**
   * Get validation errors for required fields
   */
  getRequiredErrors(values: T): Record<string, string>;

  /**
   * Check if any computed fields depend on the given path
   */
  hasDependents(path: string): boolean;

  /**
   * Evaluate all conditional rules (hidden, required, etc) for current values
   */
  evaluateAll(values: T): void;

  /**
   * Update dependencies when a path changes
   * Recalculates which fields are affected, hidden, required, etc.
   */
  updateDependencies(
    changedPath: string,
    currentValues: T,
    newValues: T,
  ): BitDependencyUpdateDiff;

  /**
   * Invalidate internal indexes (called after metadata changes)
   */
  invalidateIndexes(): void;
}
