import { getDeepValue, setDeepValue, deepEqual } from "../utils";
import type { BitResolvedConfig } from "./types";

export class BitComputedManager<T extends object> {
  constructor(private config: BitResolvedConfig<T>) {}

  apply(values: T): T {
    if (!this.config.computed) return values;

    let nextValues = values;
    const computedEntries = Object.entries(
      this.config.computed,
    ) as [string, (v: T) => unknown][];

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
