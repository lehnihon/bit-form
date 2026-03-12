import { getDeepValue, setDeepValue, deepEqual } from "../utils";
import type { BitComputedFn } from "./types";

export class BitComputedManager<T extends object> {
  constructor(private getComputedEntries: () => [string, BitComputedFn<T>][]) {}

  apply(values: T): T {
    const computedEntries = this.getComputedEntries();
    if (computedEntries.length === 0) return values;

    let nextValues = values;

    for (let i = 0; i < 2; i++) {
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
    }

    return nextValues;
  }
}
