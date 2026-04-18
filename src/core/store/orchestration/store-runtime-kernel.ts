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
import { BitStoreHistoryOrchestrator } from "./store-history-orchestrator";
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
  private readonly historyOrchestrator: BitStoreHistoryOrchestrator<T>;

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
    this.historyOrchestrator = new BitStoreHistoryOrchestrator<T>({
      debounceMs: args.historyDebounceMs,
      history: this.capabilities.history,
      notifyHistoryChanged: () => {
        this.subscriptions.notify(this.getState(), [
          getHistorySubscriptionPath(),
        ]);
      },
    });
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
      saveHistory: (values) => this.historyOrchestrator.queueSnapshot(values),
    });
  }

  flushPendingHistorySnapshot(): void {
    this.historyOrchestrator.flushPendingSnapshot();
  }

  cleanup(): void {
    this.flushPendingHistorySnapshot();
    this.historyOrchestrator.dispose();
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
      onDerivationError: (error) =>
        this.args.onUnhandledError?.(error, "derivation"),
      onStateCommitted: (payload) => this.onStateCommitted(payload),
      saveHistory: (values) => this.historyOrchestrator.queueSnapshot(values),
    });
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
