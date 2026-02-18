import { BitConfig, BitErrors, BitState, BitValidationAdapter } from "./types";

export class BitValidationManager<T extends object> {
  private validationTimeout?: any;
  private currentValidationId: number = 0;
  private asyncTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  private asyncRequests: Record<string, number> = {};
  public asyncErrors: Record<string, string> = {};

  constructor(private store: BitValidationAdapter<T>) {}

  handleAsync(path: string, value: any) {
    const config =
      this.store.deps.fieldConfigs.get(path) ||
      this.store.config.fields?.[path];
    if (!config?.asyncValidate) return;

    if (this.asyncTimers[path]) clearTimeout(this.asyncTimers[path]);

    const delay = config.asyncValidateDelay ?? 500;

    this.asyncTimers[path] = setTimeout(async () => {
      const currentRequestId = (this.asyncRequests[path] || 0) + 1;
      this.asyncRequests[path] = currentRequestId;

      this.store.internalUpdateState({
        isValidating: { ...this.store.getState().isValidating, [path]: true },
      });

      try {
        const errorMessage = await config.asyncValidate!(
          value,
          this.store.getState().values,
        );

        if (this.asyncRequests[path] !== currentRequestId) return;

        if (errorMessage) {
          this.asyncErrors[path] = errorMessage;
          this.store.setError(path, errorMessage);
        } else {
          delete this.asyncErrors[path];
          const newErrors = { ...this.store.getState().errors };
          delete newErrors[path as keyof BitErrors<T>];

          this.store.internalUpdateState({
            errors: newErrors,
            isValid: Object.keys(newErrors).length === 0,
          });
        }
      } finally {
        if (this.asyncRequests[path] === currentRequestId) {
          this.store.internalUpdateState({
            isValidating: {
              ...this.store.getState().isValidating,
              [path]: false,
            },
          });
        }
      }
    }, delay);
  }

  trigger(scopeFields?: string[]) {
    if (this.validationTimeout) clearTimeout(this.validationTimeout);

    const delay = this.store.config.validationDelay ?? 300;

    if (delay > 0) {
      this.validationTimeout = setTimeout(() => {
        this.validate({ scopeFields });
      }, delay);
    } else {
      this.validate({ scopeFields });
    }
  }

  async validate(options?: {
    scope?: string;
    scopeFields?: string[];
  }): Promise<boolean> {
    const validationId = ++this.currentValidationId;
    const currentState = this.store.getState();

    let targetFields: string[] | undefined = options?.scopeFields;

    if (options?.scope && this.store.config.scopes?.[options.scope]) {
      targetFields = this.store.config.scopes[options.scope];
    }

    let allErrors: Record<string, any> = this.store.config.resolver
      ? await this.store.config.resolver(currentState.values, {
          scopeFields: targetFields,
        })
      : {};

    const dynamicRequiredErrors = this.store.deps.getRequiredErrors(
      currentState.values,
    );
    allErrors = { ...allErrors, ...dynamicRequiredErrors };

    this.store.deps.hiddenFields.forEach((hiddenPath: string) => {
      delete allErrors[hiddenPath];
      delete this.asyncErrors[hiddenPath];
    });

    if (validationId !== this.currentValidationId) return currentState.isValid;

    if (targetFields) {
      const newErrors = { ...currentState.errors };

      targetFields.forEach((field) => {
        if (allErrors[field]) {
          newErrors[field as keyof BitErrors<T>] = allErrors[field];
        } else if (this.asyncErrors[field]) {
          newErrors[field as keyof BitErrors<T>] = this.asyncErrors[
            field
          ] as any;
        } else {
          delete newErrors[field as keyof BitErrors<T>];
        }
      });

      const isValid = Object.keys(newErrors).length === 0;
      this.store.internalUpdateState({ errors: newErrors, isValid });

      return targetFields.every((f) => !allErrors[f] && !this.asyncErrors[f]);
    }

    allErrors = { ...this.asyncErrors, ...allErrors };
    const isValid = Object.keys(allErrors).length === 0;

    this.store.internalUpdateState({
      errors: allErrors as BitErrors<T>,
      isValid,
    });

    return isValid;
  }

  clear(path: string) {
    if (this.asyncTimers[path]) clearTimeout(this.asyncTimers[path]);
    delete this.asyncErrors[path];
  }

  cancelAll() {
    if (this.validationTimeout) clearTimeout(this.validationTimeout);
    Object.values(this.asyncTimers).forEach((t) => clearTimeout(t));
  }
}
