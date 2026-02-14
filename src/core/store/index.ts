import { BitMask } from "../mask/types";
import { bitMasks } from "../mask";
import { BitConfig, BitErrors, BitState } from "./types";
import {
  deepClone,
  deepEqual,
  getDeepValue,
  setDeepValue,
  cleanPrefixedKeys,
} from "./utils";

export class BitStore<T extends object = any> {
  private state: BitState<T>;
  private listeners: Set<() => void> = new Set();
  private config: BitConfig<T>;
  private validationTimeout?: any;

  private currentValidationId: number = 0;

  private history: T[] = [];
  private historyIndex: number = -1;
  private readonly maxHistory: number = 15;

  public defaultUnmask: boolean;
  public masks: Record<string, BitMask>;

  constructor(config: BitConfig<T> = {}) {
    const rawInitial = config.initialValues || ({} as T);

    this.config = {
      validationDelay: 300,
      enableHistory: false, // Opt-in por defeito para poupar memória
      ...config,
      initialValues: deepClone(rawInitial),
    };

    this.defaultUnmask = config.defaultUnmask ?? true;
    this.masks = config.masks ?? bitMasks;

    const initialValues = deepClone(this.config.initialValues);
    const valuesWithComputeds = this.applyComputeds(initialValues);

    this.state = {
      values: valuesWithComputeds,
      errors: {},
      touched: {},
      isValid: true,
      isSubmitting: false,
      isDirty: false,
    };

    // Guarda o estado inicial no histórico se ativado
    this.saveSnapshot();
  }

  private applyComputeds(values: T): T {
    if (!this.config.computed) return values;

    let nextValues = values;
    const computedEntries = Object.entries(this.config.computed);

    for (let i = 0; i < 2; i++) {
      let changedInThisPass = false;

      for (const [path, computeFn] of computedEntries) {
        const newValue = computeFn(nextValues);
        const currentValue = getDeepValue(nextValues, path);

        if (!deepEqual(currentValue, newValue)) {
          nextValues = setDeepValue(nextValues, path, newValue);
          changedInThisPass = true;
        }
      }

      if (!changedInThisPass) break;
    }

    return nextValues;
  }

  get isValid(): boolean {
    return this.state.isValid;
  }

  get isSubmitting(): boolean {
    return this.state.isSubmitting;
  }

  get isDirty(): boolean {
    return this.state.isDirty;
  }

  getState(): BitState<T> {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  watch(path: string, callback: (value: any) => void) {
    let lastValue = deepClone(getDeepValue(this.state.values, path));
    return this.subscribe(() => {
      const newValue = getDeepValue(this.state.values, path);
      if (!deepEqual(newValue, lastValue)) {
        lastValue = deepClone(newValue);
        callback(newValue);
      }
    });
  }

  setField(path: string, value: any) {
    const newValues = setDeepValue(this.state.values, path, value);

    // Remove o erro do campo instantaneamente ao digitar (Melhora a UX)
    const newErrors = { ...this.state.errors };
    delete newErrors[path];
    const isNowValid = Object.keys(newErrors).length === 0;

    this.updateState({
      values: newValues,
      errors: newErrors,
      isValid: isNowValid,
      isDirty: !deepEqual(newValues, this.config.initialValues),
    });

    if (!this.config.resolver) {
      this.notify();
      return;
    }

    if (this.validationTimeout) clearTimeout(this.validationTimeout);

    const delay = this.config.validationDelay ?? 300;

    if (delay > 0) {
      this.validationTimeout = setTimeout(() => {
        this.validate({ scopeFields: [path] });
      }, delay);
    } else {
      this.validate({ scopeFields: [path] });
    }
  }

  blurField(path: string) {
    this.saveSnapshot();

    if (!this.state.touched[path]) {
      this.updateState({
        touched: { ...this.state.touched, [path]: true },
      });
    }

    this.validate({ scopeFields: [path] });
  }

  setValues(newValues: T) {
    const clonedValues = deepClone(newValues);
    this.config.initialValues = deepClone(clonedValues);

    if (this.validationTimeout) clearTimeout(this.validationTimeout);

    this.updateState({
      values: clonedValues,
      errors: {},
      touched: {},
      isValid: true,
      isDirty: false,
      isSubmitting: false,
    });
    this.saveSnapshot();
    this.validate();
  }

  setError(path: string, message: string | undefined) {
    this.updateState({
      errors: { ...this.state.errors, [path]: message },
      isValid: false,
    });
  }

  setErrors(errors: BitErrors<T>) {
    this.updateState({
      errors: { ...this.state.errors, ...errors },
      isValid: Object.keys(errors).length === 0,
    });
  }

  // Método para injetar os erros do Backend (ex: Laravel) direto na UI
  setServerErrors(serverErrors: Record<string, string[] | string>) {
    const formattedErrors: BitErrors<T> = {};

    for (const [key, value] of Object.entries(serverErrors)) {
      formattedErrors[key as keyof BitErrors<T>] = Array.isArray(value)
        ? value[0]
        : value;
    }

    this.updateState({
      errors: { ...this.state.errors, ...formattedErrors },
      isValid: false,
    });
  }

  reset() {
    if (this.validationTimeout) clearTimeout(this.validationTimeout);

    this.updateState({
      values: deepClone(this.config.initialValues),
      errors: {},
      touched: {},
      isValid: true,
      isDirty: false,
      isSubmitting: false,
    });
    this.saveSnapshot();
  }

  registerMask(name: string, mask: BitMask) {
    this.masks[name] = mask;
  }

  // --- Métodos de Array ---

  pushItem(path: string, value: any) {
    const currentArray = getDeepValue(this.state.values, path) || [];
    if (!Array.isArray(currentArray)) return;
    this.setField(path, [...currentArray, value]);
    this.saveSnapshot();
  }

  prependItem(path: string, value: any) {
    const currentArray = getDeepValue(this.state.values, path) || [];
    if (!Array.isArray(currentArray)) return;
    this.setField(path, [value, ...currentArray]);
    this.saveSnapshot();
  }

  insertItem(path: string, index: number, value: any) {
    const currentArray = [...(getDeepValue(this.state.values, path) || [])];
    if (!Array.isArray(currentArray)) return;
    currentArray.splice(index, 0, value);
    this.setField(path, currentArray);
    this.saveSnapshot();
  }

  removeItem(path: string, index: number) {
    const currentArray = getDeepValue(this.state.values, path);
    if (!Array.isArray(currentArray)) return;

    const newArray = currentArray.filter((_: any, i: number) => i !== index);
    const newValues = setDeepValue(this.state.values, path, newArray);

    const prefix = `${path}.${index}`;
    this.updateState({
      values: newValues,
      errors: cleanPrefixedKeys(this.state.errors, prefix),
      touched: cleanPrefixedKeys(this.state.touched, prefix),
      isDirty: !deepEqual(newValues, this.config.initialValues),
    });

    this.saveSnapshot();
    if (this.validationTimeout) clearTimeout(this.validationTimeout);
    this.validate();
  }

  swapItems(path: string, indexA: number, indexB: number) {
    const currentArray = [...(getDeepValue(this.state.values, path) || [])];
    if (!Array.isArray(currentArray)) return;

    [currentArray[indexA], currentArray[indexB]] = [
      currentArray[indexB],
      currentArray[indexA],
    ];
    this.setField(path, currentArray);
    this.saveSnapshot();
  }

  moveItem(path: string, from: number, to: number) {
    const currentArray = [...(getDeepValue(this.state.values, path) || [])];
    if (!Array.isArray(currentArray)) return;

    const [item] = currentArray.splice(from, 1);
    currentArray.splice(to, 0, item);
    this.setField(path, currentArray);
    this.saveSnapshot();
  }

  // --- Métodos de Histórico (Undo/Redo) ---

  private saveSnapshot() {
    if (!this.config.enableHistory) return;

    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(deepClone(this.state.values));

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  private restoreSnapshot() {
    const historicValues = deepClone(this.history[this.historyIndex]);
    this.updateState({ values: historicValues });
    this.validate();
  }

  get canUndo(): boolean {
    return this.config.enableHistory ? this.historyIndex > 0 : false;
  }

  get canRedo(): boolean {
    return this.config.enableHistory
      ? this.historyIndex < this.history.length - 1
      : false;
  }

  undo() {
    if (this.canUndo) {
      this.historyIndex--;
      this.restoreSnapshot();
    }
  }

  redo() {
    if (this.canRedo) {
      this.historyIndex++;
      this.restoreSnapshot();
    }
  }

  // --- Validação e Submissão ---

  async validate(options?: {
    scope?: string;
    scopeFields?: string[];
  }): Promise<boolean> {
    if (!this.config.resolver) return true;

    const validationId = ++this.currentValidationId;

    let targetFields: string[] | undefined = options?.scopeFields;

    if (options?.scope && this.config.scopes?.[options.scope]) {
      targetFields = this.config.scopes[options.scope];
    }

    const allErrors = await this.config.resolver(this.state.values, {
      scopeFields: targetFields,
    });

    if (validationId !== this.currentValidationId) {
      return this.state.isValid;
    }

    if (targetFields) {
      const newErrors = { ...this.state.errors };

      targetFields.forEach((field) => {
        if (allErrors[field]) {
          newErrors[field] = allErrors[field];
        } else {
          delete newErrors[field];
        }
      });

      const isValid = Object.keys(allErrors).length === 0;
      this.updateState({ errors: newErrors, isValid });

      return targetFields.every((field) => !allErrors[field]);
    }

    const isValid = Object.keys(allErrors).length === 0;
    this.updateState({ errors: allErrors, isValid });
    return isValid;
  }

  getStepStatus(scopeName: string) {
    const fields = this.config.scopes?.[scopeName] || [];
    const hasErrors = fields.some((f) => !!this.state.errors[f]);
    const isDirty = fields.some((f) => {
      const current = getDeepValue(this.state.values, f);
      const initial = getDeepValue(this.config.initialValues, f);
      return !deepEqual(current, initial);
    });

    return { hasErrors, isDirty };
  }

  isFieldDirty(path: string): boolean {
    const currentValue = getDeepValue(this.state.values, path);
    const initialValue = getDeepValue(this.config.initialValues, path);

    return !deepEqual(currentValue, initialValue);
  }

  async submit(onSuccess: (values: T) => void | Promise<void>) {
    if (this.state.isSubmitting) return;

    if (this.validationTimeout) clearTimeout(this.validationTimeout);

    this.updateState({ isSubmitting: true });

    const isValid = await this.validate();

    if (isValid) {
      try {
        let valuesToSubmit = deepClone(this.state.values);

        if (this.config.transform) {
          for (const path in this.config.transform) {
            const transformer = this.config.transform[path];
            if (transformer) {
              const currentVal = getDeepValue(valuesToSubmit, path);
              valuesToSubmit = setDeepValue(
                valuesToSubmit,
                path,
                transformer(currentVal, this.state.values),
              );
            }
          }
        }
        await onSuccess(valuesToSubmit);
      } catch (error) {
        console.error(error);
      }
    } else {
      const newTouched = { ...this.state.touched };
      Object.keys(this.state.errors).forEach((path) => {
        newTouched[path] = true;
      });
      this.updateState({ touched: newTouched });
    }

    this.updateState({ isSubmitting: false });
  }

  private updateState(partialState: Partial<BitState<T>>) {
    let nextState = { ...this.state, ...partialState };

    if (partialState.values) {
      nextState.values = this.applyComputeds(partialState.values);
    }

    this.state = nextState;
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}
