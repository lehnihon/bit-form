import { deepClone, setDeepValues } from "../../../../utils";
import type { BitLifecycleValuesPort } from "../../../contracts/port-types";
import type { DeepPartial } from "../../../contracts/types";
import { patchStateOperation } from "../../../engines/operation-engine";

export class BitValuesLifecycleManager<T extends object> {
  constructor(private readonly store: BitLifecycleValuesPort<T>) {}

  private collectChangedUpdates(
    values: DeepPartial<T>,
    prefix = "",
    updates: Array<readonly [string, unknown]> = [],
    activeBranch: WeakSet<object> = new WeakSet(),
  ): Array<readonly [string, unknown]> {
    if (values && typeof values === "object") {
      if (activeBranch.has(values as object)) {
        return updates;
      }

      activeBranch.add(values as object);
    }

    try {
      Object.entries(values as Record<string, unknown>).forEach(
        ([key, value]) => {
          const nextPath = prefix ? `${prefix}.${key}` : key;

          if (
            value &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            Object.keys(value as Record<string, unknown>).length > 0
          ) {
            if (activeBranch.has(value as object)) {
              return;
            }

            this.collectChangedUpdates(
              value as DeepPartial<T>,
              nextPath,
              updates,
              activeBranch,
            );
            return;
          }

          updates.push([nextPath, value]);
        },
      );
    } finally {
      if (values && typeof values === "object") {
        activeBranch.delete(values as object);
      }
    }

    return updates;
  }

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
    const changedUpdates = this.collectChangedUpdates(values);
    const changedPaths = changedUpdates.map(([path]) => path);
    const mergedValues =
      changedUpdates.length > 0
        ? setDeepValues(this.store.getState().values, changedUpdates)
        : this.store.getState().values;

    this.replaceValuesInternal(
      mergedValues,
      "hydrate",
      changedPaths.length > 0 ? changedPaths : ["*"],
    );
  }

  rebaseValues(newValues: T) {
    const previousValues = this.store.getState().values;
    const clonedValues = deepClone(newValues);

    this.store.setBaselineValues(newValues);

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
          isValid: false,
          isDirty: false,
        },
        ["*"],
      ),
    );

    this.store.resetHistory(clonedValues);
    void this.store.validateNow().catch((error) => {
      this.store.config?.onUnhandledError(error, "rebaseValues");
    });

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
    this.store.cancelAllValidations();

    const isDirty = this.store.rebuildDirtyState(
      snapshot,
      this.store.getBaselineValues(),
    );

    this.store.dispatch(
      patchStateOperation(
        {
          values: snapshot,
          errors: {},
          isValid: false,
          isDirty,
        },
        ["*"],
      ),
    );
    void this.store.validateNow().catch((error) => {
      this.store.config?.onUnhandledError(error, "applyHistoryState");
    });
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
          isValid: false,
          isDirty: false,
        },
        ["*"],
      ),
    );

    this.store.resetHistory(initialCloned);
  }

  private replaceValuesInternal(
    newValues: T,
    origin: "replaceValues" | "hydrate" = "replaceValues",
    changedPaths: string[] = ["*"],
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
          isValid: false,
          isDirty,
        },
        changedPaths,
      ),
    );

    this.store.internalSaveSnapshot();
    void this.store.validateNow().catch((error) => {
      this.store.config?.onUnhandledError(error, "replaceValuesInternal");
    });

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
