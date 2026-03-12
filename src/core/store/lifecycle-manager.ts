import { BitErrors, BitFieldChangeMeta } from "./types";
import { BitLifecycleAdapter } from "./internal-types";
import { deepClone, getDeepValue, setDeepValue } from "../utils";

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
    this.store.validatorMg.clear(path);

    const toggledFields = this.store.depsMg.updateDependencies(path, newValues);

    toggledFields.forEach((depPath) => {
      if (this.store.depsMg.isHidden(depPath)) {
        delete newErrors[depPath as keyof BitErrors<T>];
        this.store.validatorMg.clear(depPath);
      }
    });

    const isDirty = this.store.dirtyMg.updateForPath(
      path,
      newValues,
      this.store.config.initialValues,
    );

    this.store.internalUpdateState({
      values: newValues,
      errors: newErrors,
      isValid: Object.keys(newErrors).length === 0,
      isDirty,
    });

    this.store.emitFieldChange({
      path,
      previousValue,
      nextValue: value,
      values: this.store.getState().values,
      state: this.store.getState(),
      meta,
    });

    if (this.store.config.resolver) {
      this.store.validatorMg.trigger([path]);
    }

    this.store.validatorMg.handleAsync(path, value);

    return { visibilitiesChanged: toggledFields.length > 0 };
  }

  updateAll(newValues: T) {
    const previousValues = this.store.getState().values;
    const clonedValues = deepClone(newValues);

    this.store.config.initialValues = deepClone(clonedValues);

    this.store.validatorMg.cancelAll();
    this.store.depsMg.evaluateAll(clonedValues);

    this.store.dirtyMg.clear();

    this.store.internalUpdateState({
      values: clonedValues,
      errors: {},
      touched: {},
      isValidating: {},
      isValid: true,
      isDirty: false,
      isSubmitting: false,
    });

    this.store.internalSaveSnapshot();
    this.store.validatorMg.validate();

    this.store.emitFieldChange({
      path: "*",
      previousValue: previousValues,
      nextValue: clonedValues,
      values: this.store.getState().values,
      state: this.store.getState(),
      meta: { origin: "setValues" },
    });
  }

  async submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ) {
    const currentState = this.store.getState();

    if (currentState.isSubmitting) return;

    if (this.store.validatorMg.hasValidationsInProgress()) return;

    this.store.validatorMg.cancelAll();

    this.store.internalUpdateState({ isSubmitting: true });

    const isValid = await this.store.validatorMg.validate();

    if (isValid) {
      try {
        let valuesToSubmit = deepClone(this.store.getState().values);

        this.store.depsMg.hiddenFields.forEach((hiddenPath) => {
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

        const dirtyValues = this.store.dirtyMg.buildDirtyValues(valuesToSubmit);

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
          dirtyValues: this.store.dirtyMg.buildDirtyValues(
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
        dirtyValues: this.store.dirtyMg.buildDirtyValues(
          this.store.getState().values,
        ),
        state: this.store.getState(),
        success: false,
        invalid: true,
      });
    }

    this.store.internalUpdateState({ isSubmitting: false });
  }

  reset() {
    this.store.validatorMg.cancelAll();

    const initialCloned = deepClone(this.store.config.initialValues);

    this.store.depsMg.evaluateAll(initialCloned);

    this.store.dirtyMg.clear();

    this.store.internalUpdateState({
      values: initialCloned,
      errors: {},
      touched: {},
      isValidating: {},
      isValid: true,
      isDirty: false,
      isSubmitting: false,
    });

    this.store.historyMg.reset(initialCloned);
  }
}
