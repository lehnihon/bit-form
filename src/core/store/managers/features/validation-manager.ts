import { BitErrors } from "../../contracts/types";
import {
  BitFrameworkConfig,
  BitValidationOptions,
} from "../../contracts/public-types";
import { BitPipelineContext, BitPipelineRunner } from "../../shared/pipeline";
import {
  BitStoreOperation,
  patchStateOperation,
  validationCommitOperation,
} from "../../engines/operation-engine";
import { hasAnyError } from "../../shared/error-map";
import {
  mergeValidationErrors,
  resolveAsyncValidationPaths,
  runImmediateAsyncValidationStage,
} from "./validation/validation-stages";
import {
  BitAsyncValidationScheduler,
  type BitAsyncValidateFn,
} from "./validation/async-validation-scheduler";
import { BitValidationDebouncer } from "./validation/validation-debouncer";
import type {
  BitAfterValidateEvent,
  BitBeforeValidateEvent,
  BitFieldDefinition,
} from "../../contracts/types";
import type {
  BitValidationStorePort,
  BitValidationTriggerOptions,
} from "../../contracts/port-types";

interface ValidationPipelineContext<
  T extends object,
> extends BitPipelineContext {
  options?: BitValidationOptions;
  validationId: number;
  currentState: ReturnType<BitValidationStorePort<T>["getState"]>;
  targetFields?: string[];
  allErrors: Record<string, any>;
  committedErrors: BitErrors<T>;
  isValid: boolean;
  result: boolean;
  aborted: boolean;
}

export class BitValidationManager<T extends object> {
  private currentValidationId: number = 0;
  private validatingCount = 0;
  private readonly asyncErrors = new Map<string, string>();
  private readonly immediateAbortControllers = new Map<
    string,
    AbortController
  >();
  private readonly validationPipeline: BitPipelineRunner<
    ValidationPipelineContext<T>
  >;
  private readonly schedule: (fn: () => void, delayMs: number) => () => void;
  private readonly asyncScheduler: BitAsyncValidationScheduler<T>;
  private readonly debouncer: BitValidationDebouncer;

  constructor(private store: BitValidationStorePort<T>) {
    this.schedule =
      store.config.scheduler?.schedule ??
      ((fn, delayMs) => {
        const timeoutId = setTimeout(fn, delayMs);
        return () => clearTimeout(timeoutId);
      });

    this.debouncer = new BitValidationDebouncer({
      schedule: (fn, delayMs) => this.schedule(fn, delayMs),
      validate: (options) => this.validate(options),
      validationDelay: store.config.validationDelay ?? 300,
    });

    this.asyncScheduler = new BitAsyncValidationScheduler<T>({
      schedule: (fn, delayMs) => this.schedule(fn, delayMs),
      getValues: () => this.store.getState().values,
      setFieldValidating: (path, isValidating) =>
        this.updateFieldValidating(path, isValidating),
      setAsyncError: (path, message) => {
        this.asyncErrors.set(path, message);
        this.store.setError(path, message);
      },
      clearAsyncError: (path) => {
        this.asyncErrors.delete(path);
      },
      onValidationPassed: async (path) => {
        await this.commitSynchronousScopeValidation([path]);
      },
    });

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
      {
        name: "validate:sync-track",
        run: async (ctx) => this.runSynchronousTrack(ctx),
      },
      {
        name: "validate:async-track",
        run: async (ctx) => this.runAsyncTrack(ctx),
      },
      {
        name: "validate:abort-check",
        run: async (ctx) => this.abortIfOutdated(ctx),
      },
      {
        name: "validate:async-track-merge",
        run: (ctx) => this.mergeAsyncTrack(ctx),
      },
      {
        name: "validate:commit",
        run: async (ctx) => this.commitValidation(ctx),
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
    this.asyncScheduler.cancel(path);

    const abortController = this.immediateAbortControllers.get(path);
    if (abortController) {
      abortController.abort();
      this.immediateAbortControllers.delete(path);
    }
  }

  cleanupField(path: string) {
    this.cancelFieldAsync(path);
    this.asyncErrors.delete(path);
    this.updateFieldValidating(path, false);
  }

  cleanupPrefix(prefix: string) {
    this.asyncScheduler.cleanupPrefix(prefix);

    for (const path of this.immediateAbortControllers.keys()) {
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
      validationCommitOperation(newErrors, !hasAnyError(newErrors)),
    );
  }

  handleAsync(path: string, value: any) {
    const config = this.store.getFieldConfig(path);
    const asyncValidate = config?.validation?.asyncValidate;
    const asyncValidateOn = config?.validation?.asyncValidateOn ?? "blur";

    if (!asyncValidate || asyncValidateOn !== "change") {
      this.cancelFieldAsync(path);
      this.updateFieldValidating(path, false);
      return;
    }

    const delay = config.validation?.asyncValidateDelay ?? 500;
    this.asyncScheduler.handle(path, value, asyncValidate, delay);
  }

  hasValidationsInProgress(scopeFields?: string[]) {
    const state = this.store.getState();

    if (scopeFields && scopeFields.length > 0) {
      return scopeFields.some((field) => !!state.isValidating[field]);
    }

    return this.validatingCount > 0;
  }

  trigger(scopeFields?: string[], options?: BitValidationTriggerOptions) {
    this.debouncer.trigger(scopeFields, options);
  }

  async validate(options?: BitValidationOptions): Promise<boolean> {
    if (options?.scopeFields?.length) {
      options.scopeFields.forEach((fieldPath) =>
        this.cancelFieldAsync(fieldPath),
      );
    }

    const context: ValidationPipelineContext<T> = {
      options,
      validationId: ++this.currentValidationId,
      currentState: this.store.getState(),
      targetFields: options?.scopeFields,
      allErrors: {},
      committedErrors: {},
      isValid: true,
      result: true,
      aborted: false,
    };

    await this.validationPipeline.run(context);

    return context.result;
  }

  clear(path: string) {
    this.cancelFieldAsync(path);
    this.updateFieldValidating(path, false);
    this.asyncErrors.delete(path);
  }

  cancelAll() {
    this.validatingCount = 0;
    this.debouncer.cancelPending();
    this.asyncScheduler.cancelAll();
    this.asyncErrors.clear();

    this.immediateAbortControllers.forEach((controller) => {
      controller.abort();
    });
    this.immediateAbortControllers.clear();

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

  private async runSynchronousTrack(ctx: ValidationPipelineContext<T>) {
    const resolverErrors = this.store.config.resolver
      ? await this.store.config.resolver(ctx.currentState.values, {
          scopeFields: ctx.targetFields,
        })
      : {};

    const dynamicRequiredErrors = this.store.getRequiredErrors(
      ctx.currentState.values,
    );

    ctx.allErrors = { ...resolverErrors, ...dynamicRequiredErrors };

    this.store.getHiddenFields().forEach((hiddenPath) => {
      delete ctx.allErrors[hiddenPath];
      this.asyncErrors.delete(hiddenPath);
    });
  }

  private async runAsyncTrack(ctx: ValidationPipelineContext<T>) {
    const targetPaths = resolveAsyncValidationPaths<T>({
      targetFields: ctx.targetFields,
      hiddenFields: this.store.getHiddenFields(),
      getFieldConfig: (path) => this.store.getFieldConfig(path),
      forEachFieldConfig: this.store.forEachFieldConfig,
    });

    if (targetPaths.length === 0) {
      return;
    }

    await Promise.all(
      targetPaths.map((path) =>
        this.runImmediateAsyncValidation(
          path,
          ctx.currentState.values,
          ctx.validationId,
        ),
      ),
    );
  }

  private mergeAsyncTrack(ctx: ValidationPipelineContext<T>) {
    const merged = mergeValidationErrors<T>({
      targetFields: ctx.targetFields,
      currentErrors: ctx.currentState.errors,
      allErrors: ctx.allErrors,
      asyncErrors: this.asyncErrors,
    });

    ctx.committedErrors = merged.committedErrors;
    ctx.isValid = !hasAnyError(merged.committedErrors);
    ctx.result = merged.mode === "scoped" ? merged.result : ctx.isValid;
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

  private async commitValidation(ctx: ValidationPipelineContext<T>) {
    this.store.dispatch(
      validationCommitOperation(ctx.committedErrors, ctx.isValid),
    );

    await this.store.emitAfterValidate({
      values: this.store.getState().values,
      state: this.store.getState(),
      scope: ctx.options?.scope,
      scopeFields: ctx.targetFields,
      errors: ctx.committedErrors,
      result: ctx.result,
    });

    ctx.halted = true;
  }

  private async runImmediateAsyncValidation(
    path: string,
    values: T,
    validationId: number,
  ) {
    await runImmediateAsyncValidationStage<T>({
      path,
      values,
      validationId,
      currentValidationId: this.currentValidationId,
      getFieldConfig: (fieldPath) => this.store.getFieldConfig(fieldPath),
      cancelFieldAsync: (fieldPath) => this.cancelFieldAsync(fieldPath),
      createAbortController: () => new AbortController(),
      setAbortController: (fieldPath, controller) => {
        this.immediateAbortControllers.set(fieldPath, controller);
      },
      clearAbortController: (fieldPath) => {
        this.immediateAbortControllers.delete(fieldPath);
      },
      setFieldValidating: (fieldPath, isValidating) =>
        this.updateFieldValidating(fieldPath, isValidating),
      setAsyncError: (fieldPath, message) => {
        this.asyncErrors.set(fieldPath, message);
      },
      clearAsyncError: (fieldPath) => {
        this.asyncErrors.delete(fieldPath);
      },
    });
  }

  private async commitSynchronousScopeValidation(scopeFields: string[]) {
    const currentState = this.store.getState();
    const resolverErrors = this.store.config.resolver
      ? await this.store.config.resolver(currentState.values, {
          scopeFields,
        })
      : {};

    const dynamicRequiredErrors = this.store.getRequiredErrors(
      currentState.values,
    );
    const allErrors = { ...resolverErrors, ...dynamicRequiredErrors };

    this.store.getHiddenFields().forEach((hiddenPath) => {
      delete allErrors[hiddenPath];
      this.asyncErrors.delete(hiddenPath);
    });

    const scopedErrors = { ...currentState.errors } as BitErrors<T>;

    scopeFields.forEach((field) => {
      if (allErrors[field]) {
        scopedErrors[field as keyof BitErrors<T>] = allErrors[field];
      } else if (this.asyncErrors.has(field)) {
        scopedErrors[field as keyof BitErrors<T>] =
          this.asyncErrors.get(field)!;
      } else {
        delete scopedErrors[field as keyof BitErrors<T>];
      }
    });

    this.store.dispatch(
      validationCommitOperation(scopedErrors, !hasAnyError(scopedErrors)),
    );
  }
}
