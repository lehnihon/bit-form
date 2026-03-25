import { BitFieldChangeMeta, DeepPartial } from "../../contracts/types";
import type { BitSubmitResult } from "../../contracts/types";
import type { BitLifecycleStorePort } from "../../contracts/port-types";
import { BitFieldUpdateManager } from "./lifecycle/field-update-manager";
import { BitValuesLifecycleManager } from "./lifecycle/values-lifecycle-manager";
import { BitSubmitLifecycleManager } from "./lifecycle/submit-lifecycle-manager";

export class BitLifecycleManager<T extends object> {
  private readonly fieldUpdate: BitFieldUpdateManager<T>;
  private readonly values: BitValuesLifecycleManager<T>;
  private readonly submitFlow: BitSubmitLifecycleManager<T>;

  constructor(private readonly store: BitLifecycleStorePort<T>) {
    this.fieldUpdate = new BitFieldUpdateManager<T>(store);
    this.values = new BitValuesLifecycleManager<T>(store);
    this.submitFlow = new BitSubmitLifecycleManager<T>(store);
  }

  updateField(
    path: string,
    value: unknown,
    meta: BitFieldChangeMeta = { origin: "setField" },
  ) {
    this.fieldUpdate.updateField(path, value, meta);
  }

  setValues(
    newValues: T | DeepPartial<T>,
    options?: { partial?: boolean; rebase?: boolean },
  ) {
    this.values.setValues(newValues, options);
  }

  hydrateValues(values: DeepPartial<T>) {
    this.values.hydrateValues(values);
  }

  rebaseValues(newValues: T) {
    this.values.rebaseValues(newValues);
  }

  applyHistoryState(snapshot: T) {
    this.values.applyHistoryState(snapshot);
  }

  async submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ): Promise<BitSubmitResult> {
    return this.submitFlow.submit(onSuccess);
  }

  reset() {
    this.values.reset();
  }
}
