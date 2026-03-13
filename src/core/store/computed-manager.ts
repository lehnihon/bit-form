import { getDeepValue, setDeepValue, deepEqual } from "../utils";
import type { BitComputedFn } from "./types";

export class BitComputedManager<T extends object> {
  private static readonly MIN_PASSES = 4;

  constructor(private getComputedEntries: () => [string, BitComputedFn<T>][]) {}

  apply(values: T): T {
    const computedEntries = this.getComputedEntries();
    if (computedEntries.length === 0) return values;

    let nextValues = values;
    const maxPasses = Math.max(
      BitComputedManager.MIN_PASSES,
      computedEntries.length * 2,
    );

    for (let i = 0; i < maxPasses; i++) {
      let changedInThisPass = false;

      for (const [path, computeFn] of computedEntries) {
        const newValue = computeFn(nextValues);
        const currentValue = getDeepValue(nextValues, path);

        if (!deepEqual(currentValue, newValue)) {
          nextValues = setDeepValue(nextValues, path, newValue);
          changedInThisPass = true;
        }
      }

      if (!changedInThisPass) break;

      if (i === maxPasses - 1) {
        throw new Error(
          "BitStore: computed fields did not stabilize. Check for cyclic computed definitions.",
        );
      }
    }

    return nextValues;
  }
}
