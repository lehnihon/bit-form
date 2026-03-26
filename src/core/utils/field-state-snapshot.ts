/**
 * Field State Snapshot Utilities
 *
 * Shared utilities for creating and managing field state snapshots across frameworks
 * (React, Vue, Angular). Reduces code duplication while maintaining type safety.
 */

import { deepEqual } from "../utils";

/**
 * Represents a stable snapshot of field state that can be compared for equality.
 */
export interface BitFieldSnapshot<TValue = any> {
  value: TValue;
  error: string | undefined;
  touched: boolean;
  isHidden: boolean;
  isRequired: boolean;
  isDirty: boolean;
  isValidating: boolean;
}

/**
 * Creates or reuses a field state snapshot with shallow equality checking.
 *
 * This function prevents unnecessary re-renders in frameworks like React by
 * returning the same object reference when field state hasn't changed.
 *
 * @param nextState - The new field state from the store
 * @param lastSnapshot - The previous snapshot (can be null on first call)
 * @returns A stable snapshot object that can be used for equality comparison
 *
 * @example
 * ```typescript
 * const snapshot = createFieldStateSnapshot(store.getFieldState("email"), lastSnapshot);
 * if (snapshot !== lastSnapshot) {
 *   // Field state changed, update component
 *   render(snapshot);
 * }
 * ```
 */
export function createFieldStateSnapshot<TValue = any>(
  nextState: {
    value: TValue;
    error: string | undefined;
    touched: boolean;
    isHidden: boolean;
    isRequired: boolean;
    isDirty: boolean;
    isValidating: boolean;
  },
  lastSnapshot: BitFieldSnapshot<TValue> | null,
): BitFieldSnapshot<TValue> {
  // Use shallow equality: return cached if all fields are equal by reference
  if (lastSnapshot) {
    const shallowEqual =
      lastSnapshot.value === nextState.value &&
      lastSnapshot.error === nextState.error &&
      lastSnapshot.touched === nextState.touched &&
      lastSnapshot.isHidden === nextState.isHidden &&
      lastSnapshot.isRequired === nextState.isRequired &&
      lastSnapshot.isDirty === nextState.isDirty &&
      lastSnapshot.isValidating === nextState.isValidating;

    if (shallowEqual) {
      return lastSnapshot;
    }
  }

  return {
    value: nextState.value,
    error: nextState.error,
    touched: nextState.touched,
    isHidden: nextState.isHidden,
    isRequired: nextState.isRequired,
    isDirty: nextState.isDirty,
    isValidating: nextState.isValidating,
  };
}

/**
 * Deep comparison utility for field state snapshots.
 * Useful for scenarios where shallow comparison isn't sufficient (e.g., object/array values).
 *
 * @param snapshotA - First snapshot
 * @param snapshotB - Second snapshot
 * @returns true if snapshots are deeply equal
 */
export function areFieldSnapshotsEqual(
  snapshotA: BitFieldSnapshot | null | undefined,
  snapshotB: BitFieldSnapshot | null | undefined,
): boolean {
  if (snapshotA === snapshotB) return true;
  if (!snapshotA || !snapshotB) return false;

  return (
    deepEqual(snapshotA.value, snapshotB.value) &&
    snapshotA.error === snapshotB.error &&
    snapshotA.touched === snapshotB.touched &&
    snapshotA.isHidden === snapshotB.isHidden &&
    snapshotA.isRequired === snapshotB.isRequired &&
    snapshotA.isDirty === snapshotB.isDirty &&
    snapshotA.isValidating === snapshotB.isValidating
  );
}
