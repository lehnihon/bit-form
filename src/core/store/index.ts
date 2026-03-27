import type { BitConfig } from "./contracts/types";
import { BitStore } from "./bit-store-class";

export function createInternalBitStore<
  T extends object = Record<string, unknown>,
>(config: BitConfig<T> = {}) {
  return new BitStore<T>(config);
}

export { BitStore };
