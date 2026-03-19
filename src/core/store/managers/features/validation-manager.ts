import { BitErrors } from "../../contracts/types";
import {
  BitFrameworkConfig,
  BitValidationOptions,
} from "../../contracts/public-types";
import { BitPipelineContext, BitPipelineRunner } from "../../shared/pipeline";
import {
  BitStoreOperation,
  patchStateOperation,
} from "../../engines/operation-engine";
import type {
  BitAfterValidateEvent,
  BitBeforeValidateEvent,
  BitFieldDefinition,
  BitState,
} from "../../contracts/types";

export interface BitValidationStorePort<T extends object> {
  getState: () => BitState<T>;
  dispatch: (operation: BitStoreOperation<T>) => void;
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
  /** Paths acumulados durante o debounce — evita descartar paths de calls anteriores */
  private pendingScopeFields: Set<string> | null = null;
  private readonly asyncTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private readonly asyncRequests = new Map<string, number>();
  private readonly asyncErrors = new Map<string, string>();
  /** AbortControllers per field for canceling async validation requests */
  private readonly asyncAbortControllers = new Map<string, AbortController>();
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

    this.store.dispatch(
      patchStateOperation({
        isValidating: nextValidating,
      }),
    );
  }

  private cancelFieldAsync(path: string) {
    const activeTimer = this.asyncTimers.get(path);
    if (activeTimer) {
      clearTimeout(activeTimer);
      this.asyncTimers.delete(path);
    }

    // Abort any pending async validation via AbortController
    const abortController = this.asyncAbortControllers.get(path);
    if (abortController) {
      abortController.abort();
      this.asyncAbortControllers.delete(path);
    }

    // Legacy epoch increment (kept for backward compatibility)
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
    for (const path of this.asyncTimers.keys()) {
      if (path === prefix || path.startsWith(`${prefix}.`)) {
        this.cleanupField(path);
      }
    }
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
    this.store.dispatch(
      patchStateOperation({
        errors: newErrors,
        isValid: !hasErrors(newErrors),
      }),
    );
  }

  handleAsync(path: string, value: any) {
    const config = this.store.getFieldConfig(path);
    const asyncValidate = config?.validation?.asyncValidate;
    if (!asyncValidate) {
      this.updateFieldValidating(path, false);
      return;
    }

    // Cancel previous validation for this path
    this.cancelFieldAsync(path);

    const delay = config.validation?.asyncValidateDelay ?? 500;
    this.updateFieldValidating(path, true);

    // Create AbortController for this validation request
    const abortController = new AbortController();
    this.asyncAbortControllers.set(path, abortController);

    this.asyncTimers.set(
      path,
      setTimeout(async () => {
        this.asyncTimers.delete(path);

        // Check if request was aborted before execution
        if (abortController.signal.aborted) {
          return;
        }

        try {
          const errorMessage = await asyncValidate(
            value,
            this.store.getState().values,
          );

          // Check again if aborted (race condition between async call and cancel)
          if (abortController.signal.aborted) {
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
              this.store.dispatch(
                patchStateOperation({
                  errors: newErrors,
                  isValid: !hasErrors(newErrors),
                }),
              );
            }
          }
        } finally {
          // Only update state if not aborted
          if (!abortController.signal.aborted) {
            this.updateFieldValidating(path, false);
          }
          this.asyncAbortControllers.delete(path);
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
      // Acumula paths em vez de substituir — garante que paths de calls
      // anteriores dentro do mesmo debounce não sejam descartados.
      if (scopeFields && scopeFields.length > 0) {
        if (!this.pendingScopeFields) {
          this.pendingScopeFields = new Set(scopeFields);
        } else {
          for (const f of scopeFields) this.pendingScopeFields.add(f);
        }
      } else {
        // Sem scope = validação global, descarta paths acumulados
        this.pendingScopeFields = null;
      }

      const resolvedScopeFields = this.pendingScopeFields
        ? Array.from(this.pendingScopeFields)
        : undefined;

      this.validationTimeout = setTimeout(() => {
        this.pendingScopeFields = null;
        void this.validate({ scopeFields: resolvedScopeFields });
      }, delay);
    } else {
      this.pendingScopeFields = null;
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
    this.pendingScopeFields = null;

    if (this.validationTimeout) clearTimeout(this.validationTimeout);
    this.asyncTimers.forEach((timer) => clearTimeout(timer));
    this.asyncTimers.clear();
    this.asyncRequests.clear();
    this.asyncErrors.clear();

    // Abort all pending async validations
    this.asyncAbortControllers.forEach((controller) => {
      controller.abort();
    });
    this.asyncAbortControllers.clear();

    this.store.dispatch(patchStateOperation({ isValidating: {} }));
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

    this.store.dispatch(
      patchStateOperation({
        errors: newErrors,
        isValid: ctx.isValid,
      }),
    );

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

    this.store.dispatch(
      patchStateOperation({
        errors: ctx.allErrors as BitErrors<T>,
        isValid: ctx.isValid,
      }),
    );

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
