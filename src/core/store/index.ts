import { BitStore } from "./bit-store-class";
import type { BitConfig } from "./contracts/types";

export function createInternalBitStore<
  T extends object = Record<string, unknown>,
>(config: BitConfig<T> = {}): BitStore<T> {
  return new BitStore<T>(config);
}

export { BitStore };
