import type {
  BitArrayItem,
  BitArrayPath,
  BitPath,
  BitPathValue,
} from "../contracts/types";
import type { BitValidationOptions } from "../contracts/public/meta-types";
import type { BitValidationTriggerOptions } from "../contracts/port-types";
import {
  clearPersistedFeature,
  forceSavePersistedFeature,
  restorePersistedFeature,
  runRedoFeature,
  runUndoFeature,
} from "../orchestration/store-feature-ops";
import type { BitStoreRuntimeKernel } from "../orchestration/store-runtime-kernel";

export class BitStoreFeatureFacade<T extends object> {
  constructor(private readonly runtime: BitStoreRuntimeKernel<T>) {}

  // ── Arrays ───────────────────────────────────────────────────────────────

  pushItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ): void {
    this.runtime.capabilities.arrays.pushItem(path, value);
  }

  prependItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ): void {
    this.runtime.capabilities.arrays.prependItem(path, value);
  }

  insertItem<P extends BitArrayPath<T>>(
    path: P,
    index: number,
    value: BitArrayItem<BitPathValue<T, P>>,
  ): void {
    this.runtime.capabilities.arrays.insertItem(path, index, value);
  }

  removeItem<P extends BitArrayPath<T>>(path: P, index: number): void {
    this.runtime.capabilities.arrays.removeItem(path, index);
  }

  swapItems<P extends BitArrayPath<T>>(
    path: P,
    indexA: number,
    indexB: number,
  ): void {
    this.runtime.capabilities.arrays.swapItems(path, indexA, indexB);
  }

  moveItem<P extends BitArrayPath<T>>(path: P, from: number, to: number): void {
    this.runtime.capabilities.arrays.moveItem(path, from, to);
  }

  replaceItems<P extends BitArrayPath<T>>(
    path: P,
    items: BitArrayItem<BitPathValue<T, P>>[],
  ): void {
    this.runtime.capabilities.arrays.replaceItems(path, items);
  }

  clearItems<P extends BitArrayPath<T>>(path: P): void {
    this.runtime.capabilities.arrays.clearItems(path);
  }

  // ── History ──────────────────────────────────────────────────────────────

  get canUndo(): boolean {
    return this.runtime.capabilities.history.canUndo;
  }

  get canRedo(): boolean {
    return this.runtime.capabilities.history.canRedo;
  }

  undo(): void {
    runUndoFeature({
      history: this.runtime.capabilities.history,
      applyHistoryState: (values) =>
        this.runtime.capabilities.lifecycle.applyHistoryState(values),
    });
  }

  redo(): void {
    runRedoFeature({
      history: this.runtime.capabilities.history,
      applyHistoryState: (values) =>
        this.runtime.capabilities.lifecycle.applyHistoryState(values),
    });
  }

  // ── Validation ───────────────────────────────────────────────────────────

  validate(options?: BitValidationOptions): Promise<boolean> {
    return this.runtime.capabilities.validation.validate(options);
  }

  hasValidationsInProgress(scopeFields?: string[]): boolean {
    return this.runtime.capabilities.validation.hasValidationsInProgress(
      scopeFields,
    );
  }

  triggerValidation(
    scopeFields?: string[],
    options?: BitValidationTriggerOptions,
  ): void {
    this.runtime.capabilities.validation.trigger(scopeFields, options);
  }

  // ── Persist ──────────────────────────────────────────────────────────────

  async restorePersisted(): Promise<boolean> {
    return restorePersistedFeature({
      dispatch: (operation) => this.runtime.dispatch(operation),
      effects: this.runtime.effects,
    });
  }

  async forceSave(): Promise<void> {
    return forceSavePersistedFeature({
      dispatch: (operation) => this.runtime.dispatch(operation),
      effects: this.runtime.effects,
    });
  }

  async clearPersisted(): Promise<void> {
    return clearPersistedFeature({
      dispatch: (operation) => this.runtime.dispatch(operation),
      effects: this.runtime.effects,
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  cleanup(): void {
    this.runtime.cleanup();
  }
}
