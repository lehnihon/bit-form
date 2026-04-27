import { remapIndexedPath } from "../../../utils";
import type {
  BitValidationManagerPort,
  BitValidationPipelinePort,
  BitValidationTriggerOptions,
} from "../../contracts/port-types";
import { BitValidationOptions } from "../../contracts/public/meta-types";
import { patchStateOperation } from "../../engines/operation-engine";
import { BitAsyncValidationScheduler } from "./validation/async-validation-scheduler";
import { commitSynchronousScopeValidation } from "./validation/scope-validation-commit";
import { BitValidationCoordinator } from "./validation/validation-coordinator";
import { BitValidationDebouncer } from "./validation/validation-debouncer";
import type { ValidationPipelineContext } from "./validation/validation-pipeline-context";
import {
  BitValidationPipelineOrchestrator,
  type BitValidationPipelineOrchestratorDeps,
} from "./validation/validation-pipeline-orchestrator";
import { runImmediateAsyncValidationStage } from "./validation/validation-stages";

export class BitValidationManager<T extends object> {
  private validatingCount = 0;
  private readonly asyncErrors = new Map<string, string>();
  private readonly coordinator = new BitValidationCoordinator();
  private readonly validationPipeline: BitValidationPipelineOrchestrator<T>;
  private readonly pipelineStore: BitValidationPipelinePort<T>;
  private readonly schedule: (fn: () => void, delayMs: number) => () => void;
  private readonly asyncScheduler: BitAsyncValidationScheduler<T>;
  private readonly debouncer: BitValidationDebouncer;

  constructor(private store: BitValidationManagerPort<T>) {
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

    this.pipelineStore = {
      getState: () => this.store.getState(),
      dispatch: (operation) => this.store.dispatch(operation),
      config: this.store.config,
      getFieldConfig: (path) => this.store.getFieldConfig(path),
      forEachFieldConfig: (callback) => this.store.forEachFieldConfig(callback),
      getScopeFields: (scopeName) => this.store.getScopeFields(scopeName),
      getRequiredErrors: (values) => this.store.getRequiredErrors(values),
      getHiddenFields: () => this.store.getHiddenFields(),
      emitBeforeValidate: (event) => this.store.emitBeforeValidate(event),
      emitAfterValidate: (event) => this.store.emitAfterValidate(event),
    };

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
        const previousAsyncMessage = this.asyncErrors.get(path);
        this.asyncErrors.delete(path);

        if (previousAsyncMessage && !this.store.config.resolver) {
          const currentMessage = this.store.getState().errors[path];
          if (currentMessage === previousAsyncMessage) {
            this.store.setError(path, undefined);
          }
        }

        void commitSynchronousScopeValidation({
          scopeFields: [path],
          store: this.pipelineStore,
          asyncErrors: this.asyncErrors,
        }).catch((error) => {
          this.store.config.onUnhandledError(error, "validation");
        });
      },
      onValidationPassed: async (path) => {
        await commitSynchronousScopeValidation({
          scopeFields: [path],
          store: this.pipelineStore,
          asyncErrors: this.asyncErrors,
        });
      },
      onError: (error) => {
        this.store.config.onUnhandledError(error, "validation");
      },
    });

    const stageDeps: BitValidationPipelineOrchestratorDeps<T> = {
      store: this.pipelineStore,
      asyncErrors: this.asyncErrors,
      getCurrentValidationId: () => this.coordinator.getCurrentValidationId(),
      runImmediateAsyncValidation: (path, values, validationId) =>
        this.runImmediateAsyncValidation(path, values, validationId),
    };

    this.validationPipeline = new BitValidationPipelineOrchestrator<T>(
      stageDeps,
    );
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
    this.coordinator.cancelImmediate(path);
  }

  cleanupField(path: string) {
    this.cancelFieldAsync(path);
    this.asyncErrors.delete(path);
    this.updateFieldValidating(path, false);
  }

  cleanupPrefix(prefix: string) {
    this.asyncScheduler.cleanupPrefix(prefix);

    this.coordinator.cancelImmediatePrefix(prefix, (path) => {
      this.asyncErrors.delete(path);
      this.updateFieldValidating(path, false);
    });
  }

  remapArrayPaths(
    path: string,
    remapIndex: (currentIdx: number) => number | null,
  ) {
    const prefix = `${path}.`;

    this.asyncScheduler.remapPaths((currentPath) =>
      remapIndexedPath(currentPath, prefix, remapIndex),
    );

    this.coordinator.remapImmediateControllers((currentPath) =>
      remapIndexedPath(currentPath, prefix, remapIndex),
    );

    const nextAsyncErrors = new Map<string, string>();
    this.asyncErrors.forEach((message, currentPath) => {
      const nextPath = remapIndexedPath(currentPath, prefix, remapIndex);

      if (nextPath !== null) {
        nextAsyncErrors.set(nextPath, message);
      }
    });

    this.asyncErrors.clear();
    nextAsyncErrors.forEach((message, nextPath) => {
      this.asyncErrors.set(nextPath, message);
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

    this.cancelFieldAsync(path);
    this.asyncErrors.delete(path);
    this.store.setError(path, undefined);

    await this.validate({ scopeFields: [path] });
    return;
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
    const timeout = config.validation?.asyncValidateTimeout;
    this.asyncScheduler.handle(path, value, asyncValidate, delay, timeout);
  }

  hasValidationsInProgress(scopeFields?: string[]) {
    const state = this.store.getState();

    if (scopeFields && scopeFields.length > 0) {
      return scopeFields.some((field) => !!state.isValidating[field]);
    }

    return Object.keys(state.isValidating).length > 0;
  }

  trigger(scopeFields?: string[], options?: BitValidationTriggerOptions) {
    this.debouncer.trigger(scopeFields, options);
  }

  async validate(options?: BitValidationOptions): Promise<boolean> {
    try {
      if (options?.scopeFields?.length) {
        options.scopeFields.forEach((fieldPath) => {
          this.cancelFieldAsync(fieldPath);
          this.updateFieldValidating(fieldPath, false);
        });
      }

      const context: ValidationPipelineContext<T> = {
        options,
        validationId: this.coordinator.beginValidation(),
        currentState: this.store.getState(),
        targetFields: options?.scopeFields,
        allErrors: {},
        committedErrors: {},
        isValid: true,
        result: true,
        aborted: false,
      };

      await this.validationPipeline.run(context);

      if (context.aborted) {
        const liveState = this.store.getState();
        await this.store.emitAfterValidate({
          values: liveState.values,
          state: liveState,
          scope: context.options?.scope,
          scopeFields: context.targetFields,
          errors: liveState.errors,
          result: liveState.isValid,
          aborted: true,
        });
      }

      return context.result;
    } catch (error) {
      this.store.config.onUnhandledError(error, "validation");
      return false;
    }
  }

  clear(path: string) {
    this.cancelFieldAsync(path);
    this.updateFieldValidating(path, false);
    this.asyncErrors.delete(path);
  }

  cancelAll() {
    this.validatingCount = 0;
    this.debouncer.cancelPending();

    // Dispatch clear BEFORE aborting async validation, so that any resolving promises
    // in the microtask queue that leak past the abort check won't overwrite the clear state.
    this.store.dispatch(patchStateOperation({ isValidating: {} }));

    this.asyncScheduler.cancelAll();
    this.asyncErrors.clear();
    this.coordinator.cancelAllImmediate();
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
      getCurrentValidationId: () => this.coordinator.getCurrentValidationId(),
      getFieldConfig: (fieldPath) => this.store.getFieldConfig(fieldPath),
      cancelFieldAsync: (fieldPath) => this.cancelFieldAsync(fieldPath),
      createAbortController: () => new AbortController(),
      setAbortController: (fieldPath, controller) => {
        this.coordinator.setImmediateController(fieldPath, controller);
      },
      clearAbortController: (fieldPath, ctrl) => {
        return this.coordinator.clearImmediateController(fieldPath, ctrl);
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
