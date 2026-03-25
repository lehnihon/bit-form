import type { DeepPartial } from "../../../contracts/types";
import { deepClone, deepMerge } from "../../../../utils";
import { patchStateOperation } from "../../../engines/operation-engine";
import type { BitLifecycleStorePort } from "../../../contracts/port-types";

export class BitValuesLifecycleManager<T extends object> {
  constructor(private readonly store: BitLifecycleStorePort<T>) {}

  setValues(
    newValues: T | DeepPartial<T>,
    options?: { partial?: boolean; rebase?: boolean },
  ) {
    if (options?.rebase) {
      this.rebaseValues(newValues as T);
      return;
    }

    if (options?.partial) {
      this.hydrateValues(newValues as DeepPartial<T>);
      return;
    }

    this.replaceValuesInternal(newValues as T, "replaceValues");
  }

  hydrateValues(values: DeepPartial<T>) {
    const mergedValues = deepMerge(this.store.getState().values, values);
    this.replaceValuesInternal(mergedValues, "hydrate");
  }

  rebaseValues(newValues: T) {
    const previousValues = this.store.getState().values;
    const clonedValues = deepClone(newValues);

    this.store.setBaselineValues(deepClone(clonedValues));

    this.store.cancelAllValidations();
    this.store.evaluateAllDependencies(clonedValues);

    this.store.clearDirtyState();

    this.store.dispatch(
      patchStateOperation(
        {
          values: clonedValues,
          errors: {},
          touched: {},
          isValidating: {},
          isValid: true,
          isDirty: false,
          isSubmitting: false,
        },
        ["*"],
      ),
    );

    this.store.resetHistory(clonedValues);
    this.store.validateNow();

    this.store.emitFieldChange({
      path: "*",
      previousValue: previousValues,
      nextValue: clonedValues,
      values: this.store.getState().values,
      state: this.store.getState(),
      meta: { origin: "rebase" },
    });
  }

  applyHistoryState(snapshot: T) {
    const isDirty = this.store.rebuildDirtyState(
      snapshot,
      this.store.getBaselineValues(),
    );

    this.store.dispatch(
      patchStateOperation(
        {
          values: snapshot,
          isDirty,
        },
        ["*"],
      ),
    );

    this.store.triggerValidation(undefined, { forceDebounce: true });
  }

  reset() {
    this.store.cancelAllValidations();

    const initialCloned = deepClone(this.store.getBaselineValues());

    this.store.evaluateAllDependencies(initialCloned);

    this.store.clearDirtyState();

    this.store.dispatch(
      patchStateOperation(
        {
          values: initialCloned,
          errors: {},
          touched: {},
          isValidating: {},
          isValid: true,
          isDirty: false,
          isSubmitting: false,
        },
        ["*"],
      ),
    );

    this.store.resetHistory(initialCloned);
  }

  private replaceValuesInternal(
    newValues: T,
    origin: "replaceValues" | "hydrate" = "replaceValues",
  ) {
    const previousValues = this.store.getState().values;
    const clonedValues = deepClone(newValues);

    this.store.cancelAllValidations();
    this.store.evaluateAllDependencies(clonedValues);

    const isDirty = this.store.rebuildDirtyState(
      clonedValues,
      this.store.getBaselineValues(),
    );

    this.store.dispatch(
      patchStateOperation(
        {
          values: clonedValues,
          errors: {},
          isValidating: {},
          isValid: true,
          isDirty,
          isSubmitting: false,
        },
        ["*"],
      ),
    );

    this.store.internalSaveSnapshot();
    this.store.validateNow();

    this.store.emitFieldChange({
      path: "*",
      previousValue: previousValues,
      nextValue: clonedValues,
      values: this.store.getState().values,
      state: this.store.getState(),
      meta: { origin },
    });
  }
}
