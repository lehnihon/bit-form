import type { BitState } from "../types";

export type BitSelector<T extends object, TSlice> = (
  state: Readonly<BitState<T>>,
) => TSlice;

export type BitEqualityFn<TValue> = (previous: TValue, next: TValue) => boolean;

export interface BitScopedSelectorSubscriptionOptions<TValue> {
  mode?: "scoped";
  paths: string[];
  equalityFn?: BitEqualityFn<TValue>;
  emitImmediately?: boolean;
}

export interface BitTrackedSelectorSubscriptionOptions<TValue> {
  mode: "tracked";
  equalityFn?: BitEqualityFn<TValue>;
  emitImmediately?: boolean;
}

export type BitSelectorSubscriptionOptions<TValue> =
  | BitScopedSelectorSubscriptionOptions<TValue>
  | BitTrackedSelectorSubscriptionOptions<TValue>;
