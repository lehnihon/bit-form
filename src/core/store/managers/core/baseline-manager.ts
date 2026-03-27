import { deepClone } from "../../../utils";

export class BitBaselineManager<T extends object> {
  constructor(baselineValues: T) {
    this.baselineValues = deepClone(baselineValues);
  }

  private baselineValues: T;

  getValues(): T {
    return deepClone(this.baselineValues);
  }

  setValues(values: T): void {
    this.baselineValues = deepClone(values);
  }
}
