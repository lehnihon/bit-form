import { BitErrors, BitFieldChangeMeta, DeepPartial } from "./types";
import { BitLifecycleAdapter } from "./internal-types";
import { deepClone, deepMerge, getDeepValue, setDeepValue } from "../utils";

export class BitLifecycleManager<T extends object> {
  constructor(private store: BitLifecycleAdapter<T>) {}

  updateField(
    path: string,
    value: any,
    meta: BitFieldChangeMeta = { origin: "setField" },
  ) {
    const state = this.store.getState();
    const previousValue = getDeepValue(state.values, path);
    const newValues = setDeepValue(state.values, path, value);
    const newErrors = { ...state.errors };

    delete newErrors[path as keyof BitErrors<T>];
    this.store.clearFieldValidation(path);

    const toggledFields = this.store.updateDependencies(path, newValues);

    toggledFields.forEach((depPath) => {
      if (this.store.isFieldHidden(depPath)) {
        delete newErrors[depPath as keyof BitErrors<T>];
        this.store.clearFieldValidation(depPath);
      }
    });

    const isDirty = this.store.updateDirtyForPath(
      path,
      newValues,
      this.store.config.initialValues,
    );

    this.store.internalUpdateState(
      {
        values: newValues,
        errors: newErrors,
        isValid: Object.keys(newErrors).length === 0,
        isDirty,
      },
      [path],
    );

    this.store.emitFieldChange({
      path,
      previousValue,
      nextValue: value,
      values: this.store.getState().values,
      state: this.store.getState(),
      meta,
    });

    if (this.store.config.resolver) {
      this.store.triggerValidation([path]);
    }

    this.store.handleFieldAsyncValidation(path, value);
  }

  replaceValues(
    newValues: T,
    origin: "replaceValues" | "hydrate" = "replaceValues",
  ) {
    const previousValues = this.store.getState().values;
    const clonedValues = deepClone(newValues);

    this.store.cancelAllValidations();
    this.store.evaluateAllDependencies(clonedValues);

    const isDirty = this.store.rebuildDirtyState(
      clonedValues,
      this.store.config.initialValues,
    );

    this.store.internalUpdateState(
      {
        values: clonedValues,
        errors: {},
        isValidating: {},
        isValid: true,
        isDirty,
        isSubmitting: false,
      },
      ["*"],
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

  hydrateValues(values: DeepPartial<T>) {
    const mergedValues = deepMerge(this.store.getState().values, values);
    this.replaceValues(mergedValues, "hydrate");
  }

  rebaseValues(newValues: T) {
    const previousValues = this.store.getState().values;
    const clonedValues = deepClone(newValues);

    this.store.config.initialValues = deepClone(clonedValues);

    this.store.cancelAllValidations();
    this.store.evaluateAllDependencies(clonedValues);

    this.store.clearDirtyState();

    this.store.internalUpdateState(
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
    );

    this.store.internalSaveSnapshot();
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

  async submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ) {
    const currentState = this.store.getState();

    if (currentState.isSubmitting) return;

    if (this.store.hasValidationsInProgress()) return;

    this.store.cancelAllValidations();

    this.store.internalUpdateState({ isSubmitting: true });

    const isValid = await this.store.validateNow();

    if (isValid) {
      try {
        let valuesToSubmit = deepClone(this.store.getState().values);

        this.store.getHiddenFields().forEach((hiddenPath) => {
          valuesToSubmit = setDeepValue(valuesToSubmit, hiddenPath, undefined);
        });

        for (const [path, transformer] of this.store.getTransformEntries()) {
          const currentVal = getDeepValue(valuesToSubmit, path);
          valuesToSubmit = setDeepValue(
            valuesToSubmit,
            path,
            transformer(currentVal, this.store.getState().values),
          );
        }

        const dirtyValues = this.store.buildDirtyValues(valuesToSubmit);

        await this.store.emitBeforeSubmit({
          values: valuesToSubmit,
          dirtyValues,
          state: this.store.getState(),
        });

        await onSuccess(valuesToSubmit, dirtyValues);

        await this.store.emitAfterSubmit({
          values: valuesToSubmit,
          dirtyValues,
          state: this.store.getState(),
          success: true,
        });
      } catch (error) {
        await this.store.emitOperationalError({
          source: "submit",
          error,
        });

        await this.store.emitAfterSubmit({
          values: this.store.getState().values,
          dirtyValues: this.store.buildDirtyValues(
            this.store.getState().values,
          ),
          state: this.store.getState(),
          success: false,
          error,
        });

        console.error(error);
      }
    } else {
      const currentErrors = this.store.getState().errors;
      const newTouched = { ...this.store.getState().touched };

      Object.keys(currentErrors).forEach((path) => {
        newTouched[path as keyof typeof newTouched] = true;
      });

      this.store.internalUpdateState({ touched: newTouched });

      await this.store.emitAfterSubmit({
        values: this.store.getState().values,
        dirtyValues: this.store.buildDirtyValues(this.store.getState().values),
        state: this.store.getState(),
        success: false,
        invalid: true,
      });
    }

    this.store.internalUpdateState({ isSubmitting: false });
  }

  reset() {
    this.store.cancelAllValidations();

    const initialCloned = deepClone(this.store.config.initialValues);

    this.store.evaluateAllDependencies(initialCloned);

    this.store.clearDirtyState();

    this.store.internalUpdateState(
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
    );

    this.store.resetHistory(initialCloned);
  }
}
