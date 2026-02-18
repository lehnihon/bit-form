import { BitErrors, BitLifecycleAdapter } from "./types";
import { deepClone, deepEqual, getDeepValue, setDeepValue } from "./utils";

export class BitLifecycleManager<T extends object> {
  constructor(private store: BitLifecycleAdapter<T>) {}

  updateField(path: string, value: any) {
    const state = this.store.getState();
    const newValues = setDeepValue(state.values, path, value);
    const newErrors = { ...state.errors };

    delete newErrors[path as keyof BitErrors<T>];
    this.store.validator.clear(path);

    const toggledFields = this.store.deps.updateDependencies(path, newValues);

    toggledFields.forEach((depPath) => {
      if (this.store.deps.isHidden(depPath)) {
        delete newErrors[depPath as keyof BitErrors<T>];
        this.store.validator.clear(depPath);
      }
    });

    this.store.internalUpdateState({
      values: newValues,
      errors: newErrors,
      isValid: Object.keys(newErrors).length === 0,
      isDirty: !deepEqual(newValues, this.store.config.initialValues),
    });

    if (this.store.config.resolver) {
      this.store.validator.trigger([path]);
    }

    this.store.validator.handleAsync(path, value);

    return { visibilitiesChanged: toggledFields.length > 0 };
  }

  updateAll(newValues: T) {
    const clonedValues = deepClone(newValues);

    this.store.config.initialValues = deepClone(clonedValues);

    this.store.validator.cancelAll();
    this.store.deps.evaluateAll(clonedValues);

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
    this.store.validator.validate();
  }

  async submit(onSuccess: (values: T) => void | Promise<void>) {
    const currentState = this.store.getState();

    if (currentState.isSubmitting) return;

    this.store.validator.cancelAll();

    this.store.internalUpdateState({ isSubmitting: true });

    const isValid = await this.store.validator.validate();

    if (isValid) {
      try {
        let valuesToSubmit = deepClone(this.store.getState().values);

        this.store.deps.hiddenFields.forEach((hiddenPath) => {
          valuesToSubmit = setDeepValue(valuesToSubmit, hiddenPath, undefined);
        });

        if (this.store.config.transform) {
          for (const path in this.store.config.transform) {
            const transformer = this.store.config.transform[path];
            if (transformer) {
              const currentVal = getDeepValue(valuesToSubmit, path);
              valuesToSubmit = setDeepValue(
                valuesToSubmit,
                path,
                transformer(currentVal, this.store.getState().values),
              );
            }
          }
        }

        await onSuccess(valuesToSubmit);
      } catch (error) {
        console.error(error);
      }
    } else {
      const currentErrors = this.store.getState().errors;
      const newTouched = { ...this.store.getState().touched };

      Object.keys(currentErrors).forEach((path) => {
        newTouched[path as keyof typeof newTouched] = true;
      });

      this.store.internalUpdateState({ touched: newTouched });
    }

    this.store.internalUpdateState({ isSubmitting: false });
  }

  reset() {
    this.store.validator.cancelAll();

    const initialCloned = deepClone(this.store.config.initialValues);

    this.store.deps.evaluateAll(initialCloned);

    this.store.internalUpdateState({
      values: initialCloned,
      errors: {},
      touched: {},
      isValidating: {},
      isValid: true,
      isDirty: false,
      isSubmitting: false,
    });

    this.store.history.reset(initialCloned);
  }
}
