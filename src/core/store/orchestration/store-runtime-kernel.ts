import { getHistorySubscriptionPath } from "../../history-status";
import type { BitState } from "../contracts/types";
import type { BitStoreEffectEngine } from "../engines/effect-engine";
import type { BitStoreOperation } from "../engines/operation-engine";
import {
  createStoreBatchState,
  getEffectiveStoreState,
  type BitStoreBatchState,
} from "../engines/store-batch-engine";
import type { BitSubscriptionEngine } from "../engines/subscription-engine";
import type { BitStoreCapabilities } from "./capabilities";
import type { BitStoreCapabilityRegistry } from "./store-capability-registry";
import {
  commitStoreStateUpdate,
  dispatchStoreStateOperation,
  flushStoreBatchedStateUpdates,
  runStoreStateBatch,
  saveStoreHistorySnapshot,
} from "./store-state-ops";

export interface BitStoreRuntimeKernelArgs<T extends object> {
  state: BitState<T>;
  subscriptions: BitSubscriptionEngine<T>;
  effects: BitStoreEffectEngine<T>;
  capabilityRegistry: BitStoreCapabilityRegistry<T>;
  historyDebounceMs?: number;
  applyValueDerivations?: (values: T, changedPaths?: readonly string[]) => T;
  onUnhandledError?: (error: unknown, source: string) => void;
}

export class BitStoreRuntimeKernel<T extends object> {
  private state: BitState<T>;
  private readonly batchState: BitStoreBatchState<T> =
    createStoreBatchState<T>();
  private readonly historyDebounceMs: number;
  private historyTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingHistoryValues: T | null = null;

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
    this.historyDebounceMs = Math.max(0, args.historyDebounceMs ?? 300);
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
      onOperationError: (error) =>
        this.args.onUnhandledError?.(error, "derivation"),
      onStateCommitted: (payload) => this.onStateCommitted(payload),
    });
  }

  saveHistorySnapshot(): void {
    saveStoreHistorySnapshot({
      batchState: this.batchState,
      values: this.state.values,
      saveHistory: (values) => this.queueHistorySnapshot(values),
    });
  }

  flushPendingHistorySnapshot(): void {
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
      this.historyTimer = undefined;
    }

    if (!this.pendingHistoryValues) {
      return;
    }

    const values = this.pendingHistoryValues;
    this.pendingHistoryValues = null;
    this.recordHistorySnapshot(values);
  }

  cleanup(): void {
    this.flushPendingHistorySnapshot();
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
    this.state = flushStoreBatchedStateUpdates({
      state: this.state,
      batchState: this.batchState,
      applyValueDerivations: (values, changedPaths) =>
        this.applyValueDerivations(values, changedPaths),
      onStateCommitted: (payload) => this.onStateCommitted(payload),
      saveHistory: (values) => this.queueHistorySnapshot(values),
    });
  }

  private queueHistorySnapshot(values: T): void {
    if (this.historyDebounceMs <= 0) {
      this.recordHistorySnapshot(values);
      return;
    }

    this.pendingHistoryValues = values;

    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
    }

    this.historyTimer = setTimeout(() => {
      this.historyTimer = undefined;
      this.flushPendingHistorySnapshot();
    }, this.historyDebounceMs);
  }

  private recordHistorySnapshot(values: T): void {
    const before = this.capabilities.history.getMetadata();
    this.capabilities.history.saveSnapshot(values);
    const after = this.capabilities.history.getMetadata();
    this.notifyIfHistoryChanged(before, after);
  }

  private applyValueDerivations(
    values: T,
    changedPaths?: readonly string[],
  ): T {
    return this.args.applyValueDerivations
      ? this.args.applyValueDerivations(values, changedPaths)
      : values;
  }

  private notifyIfHistoryChanged(
    before: {
      canUndo: boolean;
      canRedo: boolean;
      historyIndex: number;
      historySize: number;
    },
    after: {
      canUndo: boolean;
      canRedo: boolean;
      historyIndex: number;
      historySize: number;
    },
  ): void {
    if (
      before.canUndo === after.canUndo &&
      before.canRedo === after.canRedo &&
      before.historyIndex === after.historyIndex &&
      before.historySize === after.historySize
    ) {
      return;
    }

    this.subscriptions.notify(this.getState(), [getHistorySubscriptionPath()]);
  }
}
