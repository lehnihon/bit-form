export class BitBaselineManager<T extends object> {
  constructor(private baselineValues: T) {}

  getValues(): T {
    return this.baselineValues;
  }

  setValues(values: T): void {
    this.baselineValues = values;
  }
}
