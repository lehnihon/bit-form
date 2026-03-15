import { BitErrors } from "../../contracts/types";
import {
  BitFrameworkConfig,
  BitValidationOptions,
} from "../../contracts/public-types";
import { BitPipelineContext, BitPipelineRunner } from "../../shared/pipeline";
import type {
  BitAfterValidateEvent,
  BitBeforeValidateEvent,
  BitFieldDefinition,
  BitState,
} from "../../contracts/types";

export interface BitValidationStorePort<T extends object> {
  getState: () => BitState<T>;
  internalUpdateState: (partial: Partial<BitState<T>>) => void;
  setError: (path: string, message: string | undefined) => void;
  validate: (opts: BitValidationOptions) => Promise<boolean>;
  getFieldConfig: (path: string) => BitFieldDefinition<T> | undefined;
  getScopeFields: (scopeName: string) => string[];
  config: BitFrameworkConfig<T>;
  getRequiredErrors: (values: T) => BitErrors<T>;
  getHiddenFields: () => string[];
  emitBeforeValidate: (event: BitBeforeValidateEvent<T>) => Promise<void>;
  emitAfterValidate: (event: BitAfterValidateEvent<T>) => Promise<void>;
}

interface ValidationPipelineContext<
  T extends object,
> extends BitPipelineContext {
  options?: BitValidationOptions;
  validationId: number;
  currentState: ReturnType<BitValidationStorePort<T>["getState"]>;
  targetFields?: string[];
  allErrors: Record<string, any>;
  isValid: boolean;
  result: boolean;
  aborted: boolean;
}

export class BitValidationManager<T extends object> {
  private validationTimeout?: ReturnType<typeof setTimeout>;
  private currentValidationId: number = 0;
  private asyncTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  private asyncRequests: Record<string, number> = {};
  private asyncErrors: Record<string, string> = {};

  constructor(private store: BitValidationStorePort<T>) {}

  private updateFieldValidating(path: string, isValidating: boolean) {
    this.store.internalUpdateState({
      isValidating: {
        ...this.store.getState().isValidating,
        [path]: isValidating,
      },
    });
  }

  private cancelFieldAsync(path: string) {
    if (this.asyncTimers[path]) {
      clearTimeout(this.asyncTimers[path]);
      delete this.asyncTimers[path];
    }

    this.asyncRequests[path] = (this.asyncRequests[path] || 0) + 1;
  }

  cleanupField(path: string) {
    this.cancelFieldAsync(path);
    delete this.asyncTimers[path];
    delete this.asyncRequests[path];
    delete this.asyncErrors[path];
    this.updateFieldValidating(path, false);
  }

  cleanupPrefix(prefix: string) {
    Object.keys(this.asyncTimers).forEach((path) => {
      if (path === prefix || path.startsWith(`${prefix}.`)) {
        this.cleanupField(path);
      }
    });

    Object.keys(this.asyncRequests).forEach((path) => {
      if (path === prefix || path.startsWith(`${prefix}.`)) {
        delete this.asyncRequests[path];
      }
    });

    Object.keys(this.asyncErrors).forEach((path) => {
      if (path === prefix || path.startsWith(`${prefix}.`)) {
        delete this.asyncErrors[path];
      }
    });
  }

  beginExternalValidation(path: string) {
    this.cancelFieldAsync(path);
    this.updateFieldValidating(path, true);
  }

  endExternalValidation(path: string) {
    this.updateFieldValidating(path, false);
  }

  async setExternalError(path: string, message: string | undefined) {
    if (message) {
      this.asyncErrors[path] = message;
      this.store.setError(path, message);
      return;
    }

    delete this.asyncErrors[path];

    if (this.store.validate) {
      await this.store.validate({ scopeFields: [path] });
      return;
    }

    const newErrors = { ...this.store.getState().errors };
    delete newErrors[path as keyof BitErrors<T>];
    this.store.internalUpdateState({
      errors: newErrors,
      isValid: Object.keys(newErrors).length === 0,
    });
  }

  handleAsync(path: string, value: any) {
    const config = this.store.getFieldConfig(path);
    const asyncValidate = config?.validation?.asyncValidate;
    if (!asyncValidate) {
      this.updateFieldValidating(path, false);
      return;
    }

    if (this.asyncTimers[path]) clearTimeout(this.asyncTimers[path]);

    const delay = config.validation?.asyncValidateDelay ?? 500;

    this.updateFieldValidating(path, true);

    this.asyncTimers[path] = setTimeout(async () => {
      delete this.asyncTimers[path];

      const currentRequestId = (this.asyncRequests[path] || 0) + 1;
      this.asyncRequests[path] = currentRequestId;

      try {
        const errorMessage = await asyncValidate(
          value,
          this.store.getState().values,
        );

        if (this.asyncRequests[path] !== currentRequestId) return;

        if (errorMessage) {
          this.asyncErrors[path] = errorMessage;
          this.store.setError(path, errorMessage);
        } else {
          delete this.asyncErrors[path];
          if (this.store.validate) {
            await this.store.validate({ scopeFields: [path] });
          } else {
            const newErrors = { ...this.store.getState().errors };
            delete newErrors[path as keyof BitErrors<T>];
            this.store.internalUpdateState({
              errors: newErrors,
              isValid: Object.keys(newErrors).length === 0,
            });
          }
        }
      } finally {
        if (this.asyncRequests[path] === currentRequestId) {
          this.updateFieldValidating(path, false);
        }
      }
    }, delay);
  }

  hasValidationsInProgress(scopeFields?: string[]) {
    const state = this.store.getState();

    if (scopeFields && scopeFields.length > 0) {
      return scopeFields.some((field) => !!state.isValidating[field]);
    }

    return Object.values(state.isValidating).some(Boolean);
  }

  trigger(scopeFields?: string[]) {
    if (this.validationTimeout) clearTimeout(this.validationTimeout);

    const delay = this.store.config.validationDelay ?? 300;

    if (delay > 0) {
      this.validationTimeout = setTimeout(() => {
        void this.validate({ scopeFields });
      }, delay);
    } else {
      void this.validate({ scopeFields });
    }
  }

  async validate(options?: BitValidationOptions): Promise<boolean> {
    const context: ValidationPipelineContext<T> = {
      options,
      validationId: ++this.currentValidationId,
      currentState: this.store.getState(),
      targetFields: options?.scopeFields,
      allErrors: {},
      isValid: true,
      result: true,
      aborted: false,
    };

    const pipeline = new BitPipelineRunner<ValidationPipelineContext<T>>([
      {
        name: "validate:resolve-target-fields",
        run: (ctx) => {
          if (ctx.options?.scope) {
            const scopeFields = this.store.getScopeFields(ctx.options.scope);
            if (scopeFields.length > 0) {
              ctx.targetFields = scopeFields;
            }
          }
        },
      },
      {
        name: "validate:before-hooks",
        run: async (ctx) => {
          await this.store.emitBeforeValidate({
            values: ctx.currentState.values,
            state: ctx.currentState,
            scope: ctx.options?.scope,
            scopeFields: ctx.targetFields,
          });
        },
      },
      {
        name: "validate:resolver",
        run: async (ctx) => {
          ctx.allErrors = this.store.config.resolver
            ? await this.store.config.resolver(ctx.currentState.values, {
                scopeFields: ctx.targetFields,
              })
            : {};
        },
      },
      {
        name: "validate:required-and-hidden",
        run: (ctx) => {
          const dynamicRequiredErrors = this.store.getRequiredErrors(
            ctx.currentState.values,
          );
          ctx.allErrors = { ...ctx.allErrors, ...dynamicRequiredErrors };

          this.store.getHiddenFields().forEach((hiddenPath: string) => {
            delete ctx.allErrors[hiddenPath];
            delete this.asyncErrors[hiddenPath];
          });
        },
      },
      {
        name: "validate:abort-check",
        run: async (ctx) => {
          if (ctx.validationId === this.currentValidationId) {
            return;
          }

          ctx.aborted = true;
          ctx.result = ctx.currentState.isValid;

          await this.store.emitAfterValidate({
            values: this.store.getState().values,
            state: this.store.getState(),
            scope: ctx.options?.scope,
            scopeFields: ctx.targetFields,
            errors: this.store.getState().errors,
            result: ctx.currentState.isValid,
            aborted: true,
          });

          ctx.halted = true;
        },
      },
      {
        name: "validate:commit-scoped",
        run: async (ctx) => {
          if (!ctx.targetFields) {
            return;
          }

          const newErrors = { ...ctx.currentState.errors };

          ctx.targetFields.forEach((field) => {
            if (ctx.allErrors[field]) {
              newErrors[field as keyof BitErrors<T>] = ctx.allErrors[field];
            } else if (this.asyncErrors[field]) {
              newErrors[field as keyof BitErrors<T>] = this.asyncErrors[field];
            } else {
              delete newErrors[field as keyof BitErrors<T>];
            }
          });

          ctx.isValid = Object.keys(newErrors).length === 0;
          ctx.result = ctx.targetFields.every(
            (f) => !ctx.allErrors[f] && !this.asyncErrors[f],
          );

          this.store.internalUpdateState({
            errors: newErrors,
            isValid: ctx.isValid,
          });

          await this.store.emitAfterValidate({
            values: this.store.getState().values,
            state: this.store.getState(),
            scope: ctx.options?.scope,
            scopeFields: ctx.targetFields,
            errors: newErrors,
            result: ctx.result,
          });

          ctx.halted = true;
        },
      },
      {
        name: "validate:commit-global",
        run: async (ctx) => {
          ctx.allErrors = { ...this.asyncErrors, ...ctx.allErrors };
          ctx.isValid = Object.keys(ctx.allErrors).length === 0;
          ctx.result = ctx.isValid;

          this.store.internalUpdateState({
            errors: ctx.allErrors as BitErrors<T>,
            isValid: ctx.isValid,
          });

          await this.store.emitAfterValidate({
            values: this.store.getState().values,
            state: this.store.getState(),
            scope: ctx.options?.scope,
            scopeFields: ctx.targetFields,
            errors: ctx.allErrors as BitErrors<T>,
            result: ctx.isValid,
          });
        },
      },
    ]);

    await pipeline.run(context);

    return context.result;
  }

  clear(path: string) {
    if (this.asyncTimers[path]) clearTimeout(this.asyncTimers[path]);
    delete this.asyncTimers[path];
    this.updateFieldValidating(path, false);
    delete this.asyncErrors[path];
  }

  cancelAll() {
    if (this.validationTimeout) clearTimeout(this.validationTimeout);
    Object.values(this.asyncTimers).forEach((t) => clearTimeout(t));
    this.asyncTimers = {};
    this.store.internalUpdateState({ isValidating: {} });
  }
}
