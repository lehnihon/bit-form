import {
  createStoreBatchState,
  getEffectiveStoreState,
  type BitStoreBatchState,
} from "../engines/store-batch-engine";
import type { BitStoreEffectEngine } from "../engines/effect-engine";
import type { BitStoreOperation } from "../engines/operation-engine";
import type { BitSubscriptionEngine } from "../engines/subscription-engine";
import type { BitState } from "../contracts/types";
import type { BitStoreCapabilities } from "./capabilities";
import type { BitStoreCapabilityRegistry } from "./store-capability-registry";
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
  capabilityRegistry: BitStoreCapabilityRegistry<T>;
  applyValueDerivations?: (values: T, changedPaths?: readonly string[]) => T;
}

export class BitStoreRuntimeKernel<T extends object> {
  private state: BitState<T>;
  private readonly batchState: BitStoreBatchState<T> =
    createStoreBatchState<T>();

  readonly subscriptions: BitSubscriptionEngine<T>;
  readonly effects: BitStoreEffectEngine<T>;
  readonly capabilityRegistry: BitStoreCapabilityRegistry<T>;
  readonly capabilities: BitStoreCapabilities<T>;

  constructor(private readonly args: BitStoreRuntimeKernelArgs<T>) {
    this.state = args.state;
    this.subscriptions = args.subscriptions;
    this.effects = args.effects;
    this.capabilityRegistry = args.capabilityRegistry;
    this.capabilities = args.capabilityRegistry.toCapabilities();
  }

  getCapability<K extends keyof BitStoreCapabilities<T>>(
    name: K,
  ): BitStoreCapabilities<T>[K] {
    return this.capabilityRegistry.resolve(name);
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
      applyValueDerivations: (values, changedPaths) =>
        this.applyValueDerivations(values, changedPaths),
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
      applyValueDerivations: (values, changedPaths) =>
        this.applyValueDerivations(values, changedPaths),
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

  private applyValueDerivations(
    values: T,
    changedPaths?: readonly string[],
  ): T {
    return this.args.applyValueDerivations
      ? this.args.applyValueDerivations(values, changedPaths)
      : values;
  }
}
