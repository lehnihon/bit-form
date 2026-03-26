import {
  createStoreBatchState,
  getEffectiveStoreState,
  type BitStoreBatchState,
} from "../engines/store-batch-engine";
import type { BitStoreEffectEngine } from "../engines/effect-engine";
import type { BitStoreOperation } from "../engines/operation-engine";
import type { BitSubscriptionEngine } from "../engines/subscription-engine";
import type { BitState } from "../contracts/types";
import type { BitComputedManager } from "../managers/core/computed-manager";
import type { BitStoreCapabilities } from "./capabilities";
import { applyComputedDerivations } from "../shared/value-derivation-pipeline";
import {
  commitStoreStateUpdate,
  dispatchStoreStateOperation,
  flushStoreBatchedStateUpdates,
  runStoreStateBatch,
  saveStoreHistorySnapshot,
} from "./store-state-ops";
import { getHistorySubscriptionPath } from "../../history-status";

export interface BitStoreRuntimeKernelArgs<T extends object> {
  state: BitState<T>;
  subscriptions: BitSubscriptionEngine<T>;
  effects: BitStoreEffectEngine<T>;
  capabilities: BitStoreCapabilities<T>;
  computedManager: BitComputedManager<T>;
  applyPostBatchValues?: (values: T, changedPaths?: readonly string[]) => T;
}

export class BitStoreRuntimeKernel<T extends object> {
  private state: BitState<T>;
  private readonly batchState: BitStoreBatchState<T> =
    createStoreBatchState<T>();

  readonly subscriptions: BitSubscriptionEngine<T>;
  readonly effects: BitStoreEffectEngine<T>;
  readonly capabilities: BitStoreCapabilities<T>;

  constructor(private readonly args: BitStoreRuntimeKernelArgs<T>) {
    this.state = args.state;
    this.subscriptions = args.subscriptions;
    this.effects = args.effects;
    this.capabilities = args.capabilities;
  }

  getState(): BitState<T> {
    return getEffectiveStoreState(this.state, this.batchState);
  }

  runBatch<TResult>(callback: () => TResult): TResult {
    return runStoreStateBatch({
      batchState: this.batchState,
      callback,
      flushBatchedStateUpdates: () => this.flushBatchedStateUpdates(),
    });
  }

  dispatch(operation: BitStoreOperation<T>): void {
    this.state = dispatchStoreStateOperation({
      state: this.state,
      batchState: this.batchState,
      operation,
      applyComputedValues: (values, changedPaths) =>
        applyComputedDerivations({
          values,
          changedPaths,
          applyComputed: (nextValues, nextChangedPaths) =>
            this.args.computedManager.apply(nextValues, nextChangedPaths),
        }),
      onStateCommitted: (payload) => this.onStateCommitted(payload),
    });
  }

  saveHistorySnapshot(): void {
    const before = this.capabilities.history.getMetadata();

    saveStoreHistorySnapshot({
      batchState: this.batchState,
      values: this.state.values,
      saveHistory: (values) => this.capabilities.history.saveSnapshot(values),
    });

    const after = this.capabilities.history.getMetadata();
    if (
      before.canUndo !== after.canUndo ||
      before.canRedo !== after.canRedo ||
      before.historyIndex !== after.historyIndex ||
      before.historySize !== after.historySize
    ) {
      this.subscriptions.notify(this.getState(), [
        getHistorySubscriptionPath(),
      ]);
    }
  }

  cleanup(): void {
    this.subscriptions.destroy();
    this.capabilities.validation.cancelAll();
    this.effects.destroy();
  }

  private onStateCommitted(payload: {
    nextState: BitState<T>;
    changedPaths?: Iterable<string>;
    valuesChanged: boolean;
  }): void {
    commitStoreStateUpdate({
      payload,
      setState: (state) => {
        this.state = state;
      },
      notifySubscriptions: (state, changedPaths) =>
        this.subscriptions.notify(state, changedPaths),
      notifyEffects: (state, valuesChanged) =>
        this.effects.onStateUpdated(state, valuesChanged),
    });
  }

  private flushBatchedStateUpdates(): void {
    const historyBeforeFlush = this.capabilities.history.getMetadata();

    this.state = flushStoreBatchedStateUpdates({
      state: this.state,
      batchState: this.batchState,
      applyComputedValues: (values, changedPaths) =>
        applyComputedDerivations({
          values,
          changedPaths,
          applyComputed: (nextValues, nextChangedPaths) =>
            this.args.computedManager.apply(nextValues, nextChangedPaths),
        }),
      applyPostBatchValues: this.args.applyPostBatchValues,
      onStateCommitted: (payload) => this.onStateCommitted(payload),
      saveHistory: (values) => this.capabilities.history.saveSnapshot(values),
    });

    const historyAfterFlush = this.capabilities.history.getMetadata();
    if (
      historyBeforeFlush.canUndo !== historyAfterFlush.canUndo ||
      historyBeforeFlush.canRedo !== historyAfterFlush.canRedo ||
      historyBeforeFlush.historyIndex !== historyAfterFlush.historyIndex ||
      historyBeforeFlush.historySize !== historyAfterFlush.historySize
    ) {
      this.subscriptions.notify(this.getState(), [
        getHistorySubscriptionPath(),
      ]);
    }
  }
}
