import { BitErrors, BitLifecycleAdapter } from "./types";
import { deepClone, getDeepValue, setDeepValue } from "../utils";

export class BitLifecycleManager<T extends object> {
  constructor(private store: BitLifecycleAdapter<T>) {}

  updateField(path: string, value: any) {
    const state = this.store.getState();
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

    const isDirty = (this.store as any).updateDirtyForPath(
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

    if (this.store.config.resolver) {
      this.store.validatorMg.trigger([path]);
    }

    this.store.validatorMg.handleAsync(path, value);

    return { visibilitiesChanged: toggledFields.length > 0 };
  }

  updateAll(newValues: T) {
    const clonedValues = deepClone(newValues);

    this.store.config.initialValues = deepClone(clonedValues);

    this.store.validatorMg.cancelAll();
    this.store.depsMg.evaluateAll(clonedValues);

    (this.store as any).clearDirtyPaths();

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
  }

  async submit(onSuccess: (values: T) => void | Promise<void>) {
    const currentState = this.store.getState();

    if (currentState.isSubmitting) return;

    this.store.validatorMg.cancelAll();

    this.store.internalUpdateState({ isSubmitting: true });

    const isValid = await this.store.validatorMg.validate();

    if (isValid) {
      try {
        let valuesToSubmit = deepClone(this.store.getState().values);

        this.store.depsMg.hiddenFields.forEach((hiddenPath) => {
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
    this.store.validatorMg.cancelAll();

    const initialCloned = deepClone(this.store.config.initialValues);

    this.store.depsMg.evaluateAll(initialCloned);

    (this.store as any).clearDirtyPaths();

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
