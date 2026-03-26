import { BitValidationOptions } from "../../contracts/public/meta-types";
import type { BitErrors } from "../../contracts/types";
import { BitPipelineRunner } from "../../shared/pipeline";
import {
  patchStateOperation,
  validationCommitOperation,
} from "../../engines/operation-engine";
import { hasAnyError } from "../../shared/error-map";
import { runImmediateAsyncValidationStage } from "./validation/validation-stages";
import { BitAsyncValidationScheduler } from "./validation/async-validation-scheduler";
import { BitValidationDebouncer } from "./validation/validation-debouncer";
import type {
  BitValidationStorePort,
  BitValidationTriggerOptions,
} from "../../contracts/port-types";
import type { ValidationPipelineContext } from "./validation/validation-pipeline-context";
import {
  abortIfOutdatedStage,
  commitValidationStage,
  mergeAsyncTrackStage,
  resolveTargetFieldsStage,
  runAsyncTrackStage,
  runBeforeValidateHooksStage,
  runSynchronousTrackStage,
  type BitValidationPipelineStageDeps,
} from "./validation/validation-pipeline-stages";
import { commitSynchronousScopeValidation } from "./validation/scope-validation-commit";

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
        await commitSynchronousScopeValidation({
          scopeFields: [path],
          store: this.store,
          asyncErrors: this.asyncErrors,
        });
      },
    });

    const stageDeps: BitValidationPipelineStageDeps<T> = {
      store: this.store,
      asyncErrors: this.asyncErrors,
      getCurrentValidationId: () => this.currentValidationId,
      runImmediateAsyncValidation: (path, values, validationId) =>
        this.runImmediateAsyncValidation(path, values, validationId),
    };

    this.validationPipeline = new BitPipelineRunner<
      ValidationPipelineContext<T>
    >([
      {
        name: "validate:resolve-target-fields",
        run: (ctx) => resolveTargetFieldsStage({ ctx, deps: stageDeps }),
      },
      {
        name: "validate:before-hooks",
        run: async (ctx) =>
          runBeforeValidateHooksStage({ ctx, deps: stageDeps }),
      },
      {
        name: "validate:sync-track",
        run: async (ctx) => runSynchronousTrackStage({ ctx, deps: stageDeps }),
      },
      {
        name: "validate:async-track",
        run: async (ctx) => runAsyncTrackStage({ ctx, deps: stageDeps }),
      },
      {
        name: "validate:abort-check",
        run: async (ctx) => abortIfOutdatedStage({ ctx, deps: stageDeps }),
      },
      {
        name: "validate:async-track-merge",
        run: (ctx) => mergeAsyncTrackStage({ ctx, deps: stageDeps }),
      },
      {
        name: "validate:commit",
        run: async (ctx) => commitValidationStage({ ctx, deps: stageDeps }),
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

  handleAsync(path: string, value: unknown) {
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
}
