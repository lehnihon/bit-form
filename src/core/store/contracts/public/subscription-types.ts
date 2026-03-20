import type { BitState } from "../types";

export type BitSelector<T extends object, TSlice> = (
  state: Readonly<BitState<T>>,
) => TSlice;

export type BitEqualityFn<TValue> = (previous: TValue, next: TValue) => boolean;

export interface BitSelectorSubscriptionOptions<TValue> {
  equalityFn?: BitEqualityFn<TValue>;
  emitImmediately?: boolean;
  paths?: string[];
}
