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
  getHiddenFields: () => ReadonlySet<string>;
  emitBeforeValidate: (event: BitBeforeValidateEvent<T>) => Promise<void>;
  emitAfterValidate: (event: BitAfterValidateEvent<T>) => Promise<void>;
}

interface ValidationPipelineContext<T extends object>
  extends BitPipelineContext {
  options?: BitValidationOptions;
  validationId: number;
  currentState: ReturnType<BitValidationStorePort<T>["getState"]>;
  targetFields?: string[];
  allErrors: Record<string, any>;
  isValid: boolean;
  result: boolean;
  aborted: boolean;
}

export interface BitValidationTriggerOptions {
  forceDebounce?: boolean;
}

function hasErrors(errors: Record<string, unknown>) {
  for (const _path in errors) {
    return true;
  }

  return false;
}

export class BitValidationManager<T extends object> {
  private validationTimeout?: ReturnType<typeof setTimeout>;
  private currentValidationId: number = 0;
  private asyncEpoch: number = 0;
  private validatingCount = 0;
  private readonly asyncTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private readonly asyncRequests = new Map<string, number>();
  private readonly asyncErrors = new Map<string, string>();
  private readonly validationPipeline: BitPipelineRunner<
    ValidationPipelineContext<T>
  >;

  constructor(private store: BitValidationStorePort<T>) {
    this.validationPipeline = new BitPipelineRunner<
      ValidationPipelineContext<T>
    >([
      {
        name: "validate:resolve-target-fields",
        run: (ctx) => this.resolveTargetFields(ctx),
      },
      {
        name: "validate:before-hooks",
        run: async (ctx) => this.runBeforeValidateHooks(ctx),
      },
      { name: "validate:resolver", run: async (ctx) => this.runResolver(ctx) },
      {
        name: "validate:required-and-hidden",
        run: (ctx) => this.applyRequiredAndHiddenRules(ctx),
      },
      {
        name: "validate:abort-check",
        run: async (ctx) => this.abortIfOutdated(ctx),
      },
      {
        name: "validate:commit-scoped",
        run: async (ctx) => this.commitScopedValidation(ctx),
      },
      {
        name: "validate:commit-global",
        run: async (ctx) => this.commitGlobalValidation(ctx),
      },
    ]);
  }

  private updateFieldValidating(path: string, isValidating: boolean) {
    const currentState = this.store.getState();
    const currentValue = !!currentState.isValidating[path];

    if (currentValue === isValidating) {
      return;
    }

    const nextValidating = { ...currentState.isValidating };

    if (isValidating) {
      nextValidating[path] = true;
      this.validatingCount += 1;
    } else {
      delete nextValidating[path];
      this.validatingCount = Math.max(0, this.validatingCount - 1);
    }

    this.store.internalUpdateState({
      isValidating: nextValidating,
    });
  }

  private cancelFieldAsync(path: string) {
    const activeTimer = this.asyncTimers.get(path);
    if (activeTimer) {
      clearTimeout(activeTimer);
      this.asyncTimers.delete(path);
    }

    this.asyncRequests.set(path, (this.asyncRequests.get(path) || 0) + 1);
  }

  cleanupField(path: string) {
    this.cancelFieldAsync(path);
    this.asyncTimers.delete(path);
    this.asyncRequests.delete(path);
    this.asyncErrors.delete(path);
    this.updateFieldValidating(path, false);
  }

  cleanupPrefix(prefix: string) {
    Array.from(this.asyncTimers.keys()).forEach((path) => {
      if (path === prefix || path.startsWith(`${prefix}.`)) {
        this.cleanupField(path);
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
      this.asyncErrors.set(path, message);
      this.store.setError(path, message);
      return;
    }

    this.asyncErrors.delete(path);

    if (this.store.validate) {
      await this.store.validate({ scopeFields: [path] });
      return;
    }

    const newErrors = { ...this.store.getState().errors };
    delete newErrors[path as keyof BitErrors<T>];
    this.store.internalUpdateState({
      errors: newErrors,
      isValid: !hasErrors(newErrors),
    });
  }

  handleAsync(path: string, value: any) {
    const config = this.store.getFieldConfig(path);
    const asyncValidate = config?.validation?.asyncValidate;
    if (!asyncValidate) {
      this.updateFieldValidating(path, false);
      return;
    }

    const existingTimer = this.asyncTimers.get(path);
    if (existingTimer) clearTimeout(existingTimer);

    const delay = config.validation?.asyncValidateDelay ?? 500;

    this.updateFieldValidating(path, true);

    this.asyncTimers.set(
      path,
      setTimeout(async () => {
        this.asyncTimers.delete(path);
        const requestEpoch = this.asyncEpoch;

        const currentRequestId = (this.asyncRequests.get(path) || 0) + 1;
        this.asyncRequests.set(path, currentRequestId);

        try {
          const errorMessage = await asyncValidate(
            value,
            this.store.getState().values,
          );

          if (
            this.asyncRequests.get(path) !== currentRequestId ||
            requestEpoch !== this.asyncEpoch
          ) {
            return;
          }

          if (errorMessage) {
            this.asyncErrors.set(path, errorMessage);
            this.store.setError(path, errorMessage);
          } else {
            this.asyncErrors.delete(path);
            if (this.store.validate) {
              await this.store.validate({ scopeFields: [path] });
            } else {
              const newErrors = { ...this.store.getState().errors };
              delete newErrors[path as keyof BitErrors<T>];
              this.store.internalUpdateState({
                errors: newErrors,
                isValid: !hasErrors(newErrors),
              });
            }
          }
        } finally {
          if (
            this.asyncRequests.get(path) === currentRequestId &&
            requestEpoch === this.asyncEpoch
          ) {
            this.updateFieldValidating(path, false);
          }
        }
      }, delay),
    );
  }

  hasValidationsInProgress(scopeFields?: string[]) {
    const state = this.store.getState();

    if (scopeFields && scopeFields.length > 0) {
      return scopeFields.some((field) => !!state.isValidating[field]);
    }

    return this.validatingCount > 0;
  }

  trigger(scopeFields?: string[], options?: BitValidationTriggerOptions) {
    if (this.validationTimeout) clearTimeout(this.validationTimeout);

    const configuredDelay = this.store.config.validationDelay ?? 300;
    const delay = options?.forceDebounce
      ? Math.max(1, configuredDelay)
      : configuredDelay;

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

    await this.validationPipeline.run(context);

    return context.result;
  }

  clear(path: string) {
    const timer = this.asyncTimers.get(path);
    if (timer) clearTimeout(timer);
    this.asyncTimers.delete(path);
    this.updateFieldValidating(path, false);
    this.asyncErrors.delete(path);
  }

  cancelAll() {
    this.asyncEpoch += 1;
    this.validatingCount = 0;

    if (this.validationTimeout) clearTimeout(this.validationTimeout);
    this.asyncTimers.forEach((timer) => clearTimeout(timer));
    this.asyncTimers.clear();
    this.asyncRequests.clear();
    this.asyncErrors.clear();
    this.store.internalUpdateState({ isValidating: {} });
  }

  private resolveTargetFields(ctx: ValidationPipelineContext<T>) {
    if (ctx.options?.scope) {
      const scopeFields = this.store.getScopeFields(ctx.options.scope);
      if (scopeFields.length > 0) {
        ctx.targetFields = scopeFields;
      }
    }
  }

  private async runBeforeValidateHooks(ctx: ValidationPipelineContext<T>) {
    await this.store.emitBeforeValidate({
      values: ctx.currentState.values,
      state: ctx.currentState,
      scope: ctx.options?.scope,
      scopeFields: ctx.targetFields,
    });
  }

  private async runResolver(ctx: ValidationPipelineContext<T>) {
    ctx.allErrors = this.store.config.resolver
      ? await this.store.config.resolver(ctx.currentState.values, {
          scopeFields: ctx.targetFields,
        })
      : {};
  }

  private applyRequiredAndHiddenRules(ctx: ValidationPipelineContext<T>) {
    const dynamicRequiredErrors = this.store.getRequiredErrors(
      ctx.currentState.values,
    );
    ctx.allErrors = { ...ctx.allErrors, ...dynamicRequiredErrors };

    this.store.getHiddenFields().forEach((hiddenPath) => {
      delete ctx.allErrors[hiddenPath];
      this.asyncErrors.delete(hiddenPath);
    });
  }

  private async abortIfOutdated(ctx: ValidationPipelineContext<T>) {
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
  }

  private async commitScopedValidation(ctx: ValidationPipelineContext<T>) {
    if (!ctx.targetFields) {
      return;
    }

    const newErrors = { ...ctx.currentState.errors };

    ctx.targetFields.forEach((field) => {
      if (ctx.allErrors[field]) {
        newErrors[field as keyof BitErrors<T>] = ctx.allErrors[field];
      } else if (this.asyncErrors.has(field)) {
        newErrors[field as keyof BitErrors<T>] = this.asyncErrors.get(field)!;
      } else {
        delete newErrors[field as keyof BitErrors<T>];
      }
    });

    ctx.isValid = !hasErrors(newErrors);
    ctx.result = ctx.targetFields.every(
      (field) => !ctx.allErrors[field] && !this.asyncErrors.has(field),
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
  }

  private async commitGlobalValidation(ctx: ValidationPipelineContext<T>) {
    ctx.allErrors = {
      ...Object.fromEntries(this.asyncErrors.entries()),
      ...ctx.allErrors,
    };
    ctx.isValid = !hasErrors(ctx.allErrors);
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
  }
}
