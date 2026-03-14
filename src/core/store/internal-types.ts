import { BitState } from "./types";
import type { BitFrameworkConfig } from "./public-types";

export interface BitResolvedConfig<
  T extends object = any,
> extends BitFrameworkConfig<T> {}

export interface SelectorListenerEntry<T extends object> {
  notify(nextState: Readonly<BitState<T>>): void;
}
