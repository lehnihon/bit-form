import {
  BitErrors,
  BitFieldChangeMeta,
  DeepPartial,
} from "../../contracts/types";
import {
  deepClone,
  deepMerge,
  getDeepValue,
  setDeepValue,
  setDeepValues,
} from "../../../utils";
import {
  BitPipelineContext,
  BitPipelineRunner,
  BitSyncPipelineRunner,
} from "../../shared/pipeline";
import {
  BitStoreOperation,
  patchStateOperation,
} from "../../engines/operation-engine";
import type {
  BitState,
  BitTransformFn,
  BitBeforeSubmitEvent,
  BitAfterSubmitEvent,
  BitFieldChangeEvent,
} from "../../contracts/types";
import type {
  BitFrameworkConfig,
  BitValidationOptions,
} from "../../contracts/public-types";
import type { BitValidationTriggerOptions } from "./validation-manager";

interface BitLifecycleStatePort<T extends object> {
  getState: () => BitState<T>;
  dispatch: (operation: BitStoreOperation<T>) => void;
  internalSaveSnapshot: () => void;
  batchStateUpdates<TResult>(callback: () => TResult): TResult;
  config: BitFrameworkConfig<T>;
}

interface BitLifecycleDependencyPort<T extends object> {
  getTransformEntries: () => [string, BitTransformFn<T>][];
  updateDependencies: (changedPath: string, newValues: T) => string[];
  isFieldHidden: (path: string) => boolean;
  evaluateAllDependencies: (values: T) => void;
  getHiddenFields: () => ReadonlySet<string>;
}

interface BitLifecycleValidationPort<T extends object> {
  clearFieldValidation: (path: string) => void;
  triggerValidation: (
    scopeFields?: string[],
    options?: BitValidationTriggerOptions,
  ) => void;
  handleFieldAsyncValidation: (path: string, value: any) => void;
  cancelAllValidations: () => void;
  validateNow: (options?: BitValidationOptions) => Promise<boolean>;
  hasValidationsInProgress: (scopeFields?: string[]) => boolean;
}

interface BitLifecycleDirtyPort<T extends object> {
  updateDirtyForPath: (
    path: string,
    nextValues: T,
    baselineValues: T,
  ) => boolean;
  rebuildDirtyState: (nextValues: T, baselineValues: T) => boolean;
  clearDirtyState: () => void;
  buildDirtyValues: (values: T) => Partial<T>;
  /** Returns the current baseline used for dirty comparisons. */
  getInitialValues: () => T;
  /** Updates the baseline (called by rebaseValues). */
  setInitialValues: (values: T) => void;

  resetHistory: (initialValues: T) => void;
}

interface BitLifecycleEffectsPort<T extends object> {
  emitFieldChange: (event: BitFieldChangeEvent<T>) => void;
  emitBeforeSubmit: (event: BitBeforeSubmitEvent<T>) => Promise<void>;
  emitAfterSubmit: (event: BitAfterSubmitEvent<T>) => Promise<void>;
  emitOperationalError: (event: {
    source: "submit";
    error: unknown;
    payload?: unknown;
  }) => Promise<void>;
}

export type BitLifecycleStorePort<T extends object> = BitLifecycleStatePort<T> &
  BitLifecycleDependencyPort<T> &
  BitLifecycleValidationPort<T> &
  BitLifecycleDirtyPort<T> &
  BitLifecycleEffectsPort<T>;

interface SubmitPipelineContext<T extends object> extends BitPipelineContext {
  onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>;
  isValid: boolean;
  valuesToSubmit: T;
  dirtyValues: Partial<T>;
  error?: unknown;
  invalid?: boolean;
}

interface FieldUpdatePipelineContext<T extends object>
  extends BitPipelineContext {
  path: string;
  value: any;
  meta: BitFieldChangeMeta;
  previousValue: unknown;
  nextValues: T;
  nextErrors: BitErrors<T>;
  hasMutatedErrors: boolean;
  toggledFields: string[];
  isDirty: boolean;
}

export class BitLifecycleManager<T extends object> {
  private readonly fieldUpdatePipeline: BitSyncPipelineRunner<
    FieldUpdatePipelineContext<T>
  >;
  private readonly submitPipeline: BitPipelineRunner<SubmitPipelineContext<T>>;
  private readonly reusableFieldUpdateContext: FieldUpdatePipelineContext<T> = {
    path: "",
    value: undefined,
    meta: { origin: "setField" },
    previousValue: undefined,
    nextValues: {} as T,
    nextErrors: {} as BitErrors<T>,
    hasMutatedErrors: false,
    toggledFields: [],
    isDirty: false,
  };
  private isReusableFieldUpdateContextBusy = false;

  constructor(private store: BitLifecycleStorePort<T>) {
    this.fieldUpdatePipeline = new BitSyncPipelineRunner<
      FieldUpdatePipelineContext<T>
    >([
      {
        name: "field:clear-current-error",
        run: (ctx) => this.clearCurrentError(ctx),
      },
      {
        name: "field:update-dependencies",
        run: (ctx) => this.updateDependencies(ctx),
      },
      { name: "field:update-dirty", run: (ctx) => this.updateDirtyState(ctx) },
      { name: "field:commit-state", run: (ctx) => this.commitFieldState(ctx) },
      { name: "field:emit-change", run: (ctx) => this.emitFieldChange(ctx) },
      {
        name: "field:trigger-validate",
        run: (ctx) => this.triggerResolverValidation(ctx),
      },
      {
        name: "field:trigger-async-validate",
        run: (ctx) => this.triggerAsyncValidation(ctx),
      },
    ]);

    this.submitPipeline = new BitPipelineRunner<SubmitPipelineContext<T>>([
      { name: "submit:start", run: async (ctx) => this.startSubmit(ctx) },
      {
        name: "submit:invalid",
        run: async (ctx) => this.handleInvalidSubmit(ctx),
      },
      { name: "submit:prepare", run: (ctx) => this.prepareSubmitValues(ctx) },
      {
        name: "submit:before-hooks",
        run: async (ctx) => this.runBeforeSubmitHooks(ctx),
      },
      {
        name: "submit:user-handler",
        run: async (ctx) => this.runSubmitHandler(ctx),
      },
      {
        name: "submit:after-hooks",
        run: async (ctx) => this.runAfterSubmitHooks(ctx),
      },
    ]);
  }

  updateField(
    path: string,
    value: any,
    meta: BitFieldChangeMeta = { origin: "setField" },
  ) {
    const state = this.store.getState();
    const context = this.acquireFieldUpdateContext();

    context.path = path;
    context.value = value;
    context.meta = meta;
    context.previousValue = getDeepValue(state.values, path);
    context.nextValues = setDeepValue(state.values, path, value);
    context.nextErrors = state.errors;
    context.hasMutatedErrors = false;
    context.toggledFields.length = 0;
    context.isDirty = false;

    const isReusableContext = context === this.reusableFieldUpdateContext;

    if (isReusableContext) {
      this.isReusableFieldUpdateContextBusy = true;
    }

    try {
      this.fieldUpdatePipeline.run(context);
    } finally {
      if (isReusableContext) {
        this.isReusableFieldUpdateContextBusy = false;
      }
    }
  }

  private acquireFieldUpdateContext(): FieldUpdatePipelineContext<T> {
    if (!this.isReusableFieldUpdateContextBusy) {
      return this.reusableFieldUpdateContext;
    }

    return {
      path: "",
      value: undefined,
      meta: { origin: "setField" },
      previousValue: undefined,
      nextValues: {} as T,
      nextErrors: {} as BitErrors<T>,
      hasMutatedErrors: false,
      toggledFields: [],
      isDirty: false,
    };
  }

  setValues(
    newValues: T | DeepPartial<T>,
    options?: { partial?: boolean; rebase?: boolean },
  ) {
    if (options?.rebase) {
      this.rebaseValues(newValues as T);
      return;
    }

    if (options?.partial) {
      this.hydrateValues(newValues as DeepPartial<T>);
      return;
    }

    this.replaceValuesInternal(newValues as T, "replaceValues");
  }

  private replaceValuesInternal(
    newValues: T,
    origin: "replaceValues" | "hydrate" = "replaceValues",
  ) {
    const previousValues = this.store.getState().values;
    const clonedValues = deepClone(newValues);

    this.store.cancelAllValidations();
    this.store.evaluateAllDependencies(clonedValues);

    const isDirty = this.store.rebuildDirtyState(
      clonedValues,
      this.store.getInitialValues(),
    );

    this.store.dispatch(
      patchStateOperation(
        {
          values: clonedValues,
          errors: {},
          isValidating: {},
          isValid: true,
          isDirty,
          isSubmitting: false,
        },
        ["*"],
      ),
    );

    this.store.internalSaveSnapshot();
    this.store.validateNow();

    this.store.emitFieldChange({
      path: "*",
      previousValue: previousValues,
      nextValue: clonedValues,
      values: this.store.getState().values,
      state: this.store.getState(),
      meta: { origin },
    });
  }

  hydrateValues(values: DeepPartial<T>) {
    const mergedValues = deepMerge(this.store.getState().values, values);
    this.replaceValuesInternal(mergedValues, "hydrate");
  }

  rebaseValues(newValues: T) {
    const previousValues = this.store.getState().values;
    const clonedValues = deepClone(newValues);

    this.store.setInitialValues(deepClone(clonedValues));

    this.store.cancelAllValidations();
    this.store.evaluateAllDependencies(clonedValues);

    this.store.clearDirtyState();

    this.store.dispatch(
      patchStateOperation(
        {
          values: clonedValues,
          errors: {},
          touched: {},
          isValidating: {},
          isValid: true,
          isDirty: false,
          isSubmitting: false,
        },
        ["*"],
      ),
    );

    this.store.internalSaveSnapshot();
    this.store.validateNow();

    this.store.emitFieldChange({
      path: "*",
      previousValue: previousValues,
      nextValue: clonedValues,
      values: this.store.getState().values,
      state: this.store.getState(),
      meta: { origin: "rebase" },
    });
  }

  async submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ) {
    const currentState = this.store.getState();

    if (currentState.isSubmitting) return;

    if (this.store.hasValidationsInProgress()) return;

    this.store.cancelAllValidations();

    const context: SubmitPipelineContext<T> = {
      onSuccess,
      isValid: false,
      valuesToSubmit: deepClone(this.store.getState().values),
      dirtyValues: {},
    };

    try {
      await this.submitPipeline.run(context);
    } catch (error) {
      context.error = error;

      await this.store.emitOperationalError({
        source: "submit",
        error,
      });

      await this.store.emitAfterSubmit({
        values: this.store.getState().values,
        dirtyValues: this.store.buildDirtyValues(this.store.getState().values),
        state: this.store.getState(),
        success: false,
        error,
      });

      console.error(error);
    } finally {
      this.store.dispatch(patchStateOperation({ isSubmitting: false }));
    }
  }

  reset() {
    this.store.cancelAllValidations();

    const initialCloned = deepClone(this.store.getInitialValues());

    this.store.evaluateAllDependencies(initialCloned);

    this.store.clearDirtyState();

    this.store.dispatch(
      patchStateOperation(
        {
          values: initialCloned,
          errors: {},
          touched: {},
          isValidating: {},
          isValid: true,
          isDirty: false,
          isSubmitting: false,
        },
        ["*"],
      ),
    );

    this.store.resetHistory(initialCloned);
  }

  private clearCurrentError(ctx: FieldUpdatePipelineContext<T>) {
    const hasCurrentError = Object.prototype.hasOwnProperty.call(
      ctx.nextErrors,
      ctx.path,
    );

    if (hasCurrentError && !ctx.hasMutatedErrors) {
      ctx.nextErrors = { ...ctx.nextErrors };
      ctx.hasMutatedErrors = true;
    }

    if (hasCurrentError) {
      delete ctx.nextErrors[ctx.path as keyof BitErrors<T>];
    }

    this.store.clearFieldValidation(ctx.path);
  }

  private updateDependencies(ctx: FieldUpdatePipelineContext<T>) {
    ctx.toggledFields = this.store.updateDependencies(ctx.path, ctx.nextValues);

    ctx.toggledFields.forEach((depPath) => {
      if (this.store.isFieldHidden(depPath)) {
        const hasDependencyError = Object.prototype.hasOwnProperty.call(
          ctx.nextErrors,
          depPath,
        );

        if (hasDependencyError && !ctx.hasMutatedErrors) {
          ctx.nextErrors = { ...ctx.nextErrors };
          ctx.hasMutatedErrors = true;
        }

        if (hasDependencyError) {
          delete ctx.nextErrors[depPath as keyof BitErrors<T>];
        }

        this.store.clearFieldValidation(depPath);
      }
    });
  }

  private updateDirtyState(ctx: FieldUpdatePipelineContext<T>) {
    ctx.isDirty = this.store.updateDirtyForPath(
      ctx.path,
      ctx.nextValues,
      this.store.getInitialValues(),
    );
  }

  private commitFieldState(ctx: FieldUpdatePipelineContext<T>) {
    this.store.dispatch(
      patchStateOperation(
        {
          values: ctx.nextValues,
          errors: ctx.nextErrors,
          isDirty: ctx.isDirty,
        },
        [ctx.path, ...ctx.toggledFields],
      ),
    );
  }

  private emitFieldChange(ctx: FieldUpdatePipelineContext<T>) {
    this.store.emitFieldChange({
      path: ctx.path,
      previousValue: ctx.previousValue,
      nextValue: ctx.value,
      values: this.store.getState().values,
      state: this.store.getState(),
      meta: ctx.meta,
    });
  }

  private triggerResolverValidation(ctx: FieldUpdatePipelineContext<T>) {
    if (this.store.config.resolver) {
      this.store.triggerValidation([ctx.path]);
    }
  }

  private triggerAsyncValidation(ctx: FieldUpdatePipelineContext<T>) {
    this.store.handleFieldAsyncValidation(ctx.path, ctx.value);
  }

  private async startSubmit(ctx: SubmitPipelineContext<T>) {
    this.store.dispatch(patchStateOperation({ isSubmitting: true }));
    ctx.isValid = await this.store.validateNow();
  }

  private async handleInvalidSubmit(ctx: SubmitPipelineContext<T>) {
    if (ctx.isValid) return;

    const currentErrors = this.store.getState().errors;
    const newTouched = { ...this.store.getState().touched };

    Object.keys(currentErrors).forEach((path) => {
      newTouched[path as keyof typeof newTouched] = true;
    });

    this.store.batchStateUpdates(() => {
      this.store.dispatch(patchStateOperation({ touched: newTouched }));
    });

    ctx.dirtyValues = this.store.buildDirtyValues(this.store.getState().values);
    ctx.invalid = true;

    await this.store.emitAfterSubmit({
      values: this.store.getState().values,
      dirtyValues: ctx.dirtyValues,
      state: this.store.getState(),
      success: false,
      invalid: true,
    });

    ctx.halted = true;
  }

  private prepareSubmitValues(ctx: SubmitPipelineContext<T>) {
    const updates: Array<[string, unknown]> = [];

    this.store.getHiddenFields().forEach((hiddenPath) => {
      updates.push([hiddenPath, undefined]);
    });

    for (const [path, transformer] of this.store.getTransformEntries()) {
      const currentVal = getDeepValue(ctx.valuesToSubmit, path);
      updates.push([
        path,
        transformer(currentVal, this.store.getState().values),
      ]);
    }

    if (updates.length > 0) {
      ctx.valuesToSubmit = setDeepValues(ctx.valuesToSubmit, updates);
    }

    ctx.dirtyValues = this.store.buildDirtyValues(ctx.valuesToSubmit);
  }

  private async runBeforeSubmitHooks(ctx: SubmitPipelineContext<T>) {
    await this.store.emitBeforeSubmit({
      values: ctx.valuesToSubmit,
      dirtyValues: ctx.dirtyValues,
      state: this.store.getState(),
    });
  }

  private async runSubmitHandler(ctx: SubmitPipelineContext<T>) {
    await ctx.onSuccess(ctx.valuesToSubmit, ctx.dirtyValues);
  }

  private async runAfterSubmitHooks(ctx: SubmitPipelineContext<T>) {
    await this.store.emitAfterSubmit({
      values: ctx.valuesToSubmit,
      dirtyValues: ctx.dirtyValues,
      state: this.store.getState(),
      success: true,
    });
  }
}
