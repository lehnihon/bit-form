export type BitErrors<T> = Partial<Record<string, string>>;
export type BitTouched<T> = Partial<Record<string, boolean>>;

export interface BitState<T> {
  values: T;
  errors: BitErrors<T>;
  touched: BitTouched<T>;
  isValid: boolean;
  isSubmitting: boolean;
}

export type ValidatorFn<T> = (values: T) => Promise<BitErrors<T>> | BitErrors<T>;

export interface BitConfig<T> {
  initialValues: T;
  resolver?: ValidatorFn<T>;
  transform?: Partial<Record<string, (value: any) => any>>;
}

export class BitStore<T extends Record<string, any> | any[] = any> {
  private state: BitState<T>;
  private listeners: Set<() => void> = new Set();
  private resolver?: ValidatorFn<T>;
  private transform?: Partial<Record<string, (value: any) => any>>;

  constructor(config: BitConfig<T>) {
    this.state = {
      values: this.deepClone(config.initialValues),
      errors: {},
      touched: {},
      isValid: true,
      isSubmitting: false,
    };
    this.resolver = config.resolver;
    this.transform = config.transform;
  }

  // --- ACESSO AO ESTADO (GETTERS PÚBLICOS) ---

  /** Retorna o estado completo (somente leitura) */
  getState(): BitState<T> {
    return this.state;
  }

  /** Atalho para verificar se o formulário é válido */
  get isValid(): boolean {
    return this.state.isValid;
  }

  /** Atalho para verificar se o formulário está enviando dados */
  get isSubmitting(): boolean {
    return this.state.isSubmitting;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  // --- MANIPULAÇÃO DE CAMPOS ---

  setField(path: string, value: any) {
    const newValues = this.setDeepValue(this.state.values, path, value);
    this.state = { ...this.state, values: newValues };

    if (this.resolver) this.validateField();
    this.notify();
  }

  blurField(path: string) {
    if (this.state.touched[path]) return;

    this.state = {
      ...this.state,
      touched: { ...this.state.touched, [path]: true },
    };
    
    if (this.resolver) this.validateField();
    this.notify();
  }

  // --- MANIPULAÇÃO DE ARRAYS ---

  pushItem(path: string, value: any) {
    const currentArray = this.getDeepValue(this.state.values, path) || [];
    if (!Array.isArray(currentArray)) return;

    const newArray = [...currentArray, value];
    this.setField(path, newArray);
  }

  removeItem(path: string, index: number) {
    const currentArray = this.getDeepValue(this.state.values, path);
    if (!Array.isArray(currentArray)) return;

    const newArray = currentArray.filter((_, i) => i !== index);
    const newValues = this.setDeepValue(this.state.values, path, newArray);
    
    // Limpeza de erros e touched do índice removido
    const prefix = `${path}.${index}`;
    const newErrors = this.cleanPrefixedKeys(this.state.errors, prefix);
    const newTouched = this.cleanPrefixedKeys(this.state.touched, prefix);

    this.state = {
      ...this.state,
      values: newValues,
      errors: newErrors,
      touched: newTouched
    };

    if (this.resolver) this.validateField();
    this.notify();
  }

  // --- VALIDAÇÃO E SUBMISSÃO ---

  async validate(): Promise<boolean> {
    if (!this.resolver) return true;

    const errors = await this.resolver(this.state.values);
    const isValid = Object.keys(errors).length === 0;

    this.state = { ...this.state, errors, isValid };
    this.notify();
    return isValid;
  }

  async submit(onSuccess: (values: T) => void | Promise<void>) {
    this.state = { ...this.state, isSubmitting: true };
    this.notify();

    const isValid = await this.validate();
    
    if (isValid) {
      let valuesToSubmit = this.deepClone(this.state.values);

      if (this.transform) {
        for (const path in this.transform) {
          const transformer = this.transform[path];
          if (transformer) {
            const currentVal = this.getDeepValue(valuesToSubmit, path);
            valuesToSubmit = this.setDeepValue(valuesToSubmit, path, transformer(currentVal));
          }
        }
      }
      await onSuccess(valuesToSubmit);
    }

    this.state = { ...this.state, isSubmitting: false };
    this.notify();
  }

  private async validateField() {
    if (!this.resolver) return;
    const errors = await this.resolver(this.state.values);
    this.state = {
      ...this.state,
      errors,
      isValid: Object.keys(errors).length === 0
    };
    this.notify();
  }

  // --- HELPERS INTERNOS ---

  private getDeepValue(obj: any, path: string): any {
    return path.split('.').reduce((prev, curr) => prev?.[curr], obj);
  }

  private setDeepValue(obj: any, path: string, value: any): any {
    const keys = path.split('.');
    const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
    let current = newObj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      const nextKey = keys[i + 1];
      const isNextKeyIndex = !isNaN(Number(nextKey));
      
      current[key] = current[key] 
        ? (Array.isArray(current[key]) ? [...current[key]] : { ...current[key] })
        : (isNextKeyIndex ? [] : {});
      
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
    return newObj;
  }

  private cleanPrefixedKeys(obj: Record<string, any>, prefix: string): Record<string, any> {
    const newObj = { ...obj };
    const prefixWithDot = `${prefix}.`;
    Object.keys(newObj).forEach(key => {
      if (key === prefix || key.startsWith(prefixWithDot)) {
        delete newObj[key];
      }
    });
    return newObj;
  }

  private deepClone(obj: any) {
    return JSON.parse(JSON.stringify(obj));
  }
}