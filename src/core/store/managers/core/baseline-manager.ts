import { deepClone } from "../../../utils";

export class BitBaselineManager<T extends object> {
  constructor(baselineValues: T) {
    this.baselineValues = deepClone(baselineValues);
  }

  private baselineValues: T;
  private baselineSnapshot?: Readonly<T>;

  getValues(): T {
    if (!this.baselineSnapshot) {
      this.baselineSnapshot = Object.freeze(deepClone(this.baselineValues));
    }

    return this.baselineSnapshot as T;
  }

  setValues(values: T): void {
    this.baselineValues = deepClone(values);
    this.baselineSnapshot = undefined;
  }
}
