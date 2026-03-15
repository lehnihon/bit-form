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
} from "../../../utils";
import {
  BitPipelineContext,
  BitPipelineRunner,
  BitSyncPipelineRunner,
} from "../../shared/pipeline";
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

export interface BitLifecycleStorePort<T extends object> {
  getState: () => BitState<T>;
  internalUpdateState: (
    partial: Partial<BitState<T>>,
    changedPaths?: string[],
  ) => void;
  internalSaveSnapshot: () => void;
  getTransformEntries: () => [string, BitTransformFn<T>][];
  config: BitFrameworkConfig<T>;

  updateDependencies: (changedPath: string, newValues: T) => string[];
  isFieldHidden: (path: string) => boolean;
  evaluateAllDependencies: (values: T) => void;
  getHiddenFields: () => string[];

  clearFieldValidation: (path: string) => void;
  triggerValidation: (scopeFields?: string[]) => void;
  handleFieldAsyncValidation: (path: string, value: any) => void;
  cancelAllValidations: () => void;
  validateNow: (options?: BitValidationOptions) => Promise<boolean>;
  hasValidationsInProgress: (scopeFields?: string[]) => boolean;

  updateDirtyForPath: (
    path: string,
    nextValues: T,
    baselineValues: T,
  ) => boolean;
  rebuildDirtyState: (nextValues: T, baselineValues: T) => boolean;
  clearDirtyState: () => void;
  buildDirtyValues: (values: T) => Partial<T>;

  resetHistory: (initialValues: T) => void;

  emitFieldChange: (event: BitFieldChangeEvent<T>) => void;
  emitBeforeSubmit: (event: BitBeforeSubmitEvent<T>) => Promise<void>;
  emitAfterSubmit: (event: BitAfterSubmitEvent<T>) => Promise<void>;
  emitOperationalError: (event: {
    source: "submit";
    error: unknown;
    payload?: unknown;
  }) => Promise<void>;
}

interface SubmitPipelineContext<T extends object> extends BitPipelineContext {
  onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>;
  isValid: boolean;
  valuesToSubmit: T;
  dirtyValues: Partial<T>;
  error?: unknown;
  invalid?: boolean;
}

interface FieldUpdatePipelineContext<
  T extends object,
> extends BitPipelineContext {
  path: string;
  value: any;
  meta: BitFieldChangeMeta;
  previousValue: unknown;
  nextValues: T;
  nextErrors: BitErrors<T>;
  toggledFields: string[];
  isDirty: boolean;
}

export class BitLifecycleManager<T extends object> {
  constructor(private store: BitLifecycleStorePort<T>) {}

  updateField(
    path: string,
    value: any,
    meta: BitFieldChangeMeta = { origin: "setField" },
  ) {
    const state = this.store.getState();

    const context: FieldUpdatePipelineContext<T> = {
      path,
      value,
      meta,
      previousValue: getDeepValue(state.values, path),
      nextValues: setDeepValue(state.values, path, value),
      nextErrors: { ...state.errors },
      toggledFields: [],
      isDirty: false,
    };

    const pipeline = new BitSyncPipelineRunner<FieldUpdatePipelineContext<T>>([
      {
        name: "field:clear-current-error",
        run: (ctx) => {
          delete ctx.nextErrors[ctx.path as keyof BitErrors<T>];
          this.store.clearFieldValidation(ctx.path);
        },
      },
      {
        name: "field:update-dependencies",
        run: (ctx) => {
          ctx.toggledFields = this.store.updateDependencies(
            ctx.path,
            ctx.nextValues,
          );

          ctx.toggledFields.forEach((depPath) => {
            if (this.store.isFieldHidden(depPath)) {
              delete ctx.nextErrors[depPath as keyof BitErrors<T>];
              this.store.clearFieldValidation(depPath);
            }
          });
        },
      },
      {
        name: "field:update-dirty",
        run: (ctx) => {
          ctx.isDirty = this.store.updateDirtyForPath(
            ctx.path,
            ctx.nextValues,
            this.store.config.initialValues,
          );
        },
      },
      {
        name: "field:commit-state",
        run: (ctx) => {
          this.store.internalUpdateState(
            {
              values: ctx.nextValues,
              errors: ctx.nextErrors,
              isValid: Object.keys(ctx.nextErrors).length === 0,
              isDirty: ctx.isDirty,
            },
            [ctx.path, ...ctx.toggledFields],
          );
        },
      },
      {
        name: "field:emit-change",
        run: (ctx) => {
          this.store.emitFieldChange({
            path: ctx.path,
            previousValue: ctx.previousValue,
            nextValue: ctx.value,
            values: this.store.getState().values,
            state: this.store.getState(),
            meta: ctx.meta,
          });
        },
      },
      {
        name: "field:trigger-validate",
        run: (ctx) => {
          if (this.store.config.resolver) {
            this.store.triggerValidation([ctx.path]);
          }
        },
      },
      {
        name: "field:trigger-async-validate",
        run: (ctx) => {
          this.store.handleFieldAsyncValidation(ctx.path, ctx.value);
        },
      },
    ]);

    pipeline.run(context);
  }

  replaceValues(
    newValues: T,
    origin: "replaceValues" | "hydrate" = "replaceValues",
  ) {
    const previousValues = this.store.getState().values;
    const clonedValues = deepClone(newValues);

    this.store.cancelAllValidations();
    this.store.evaluateAllDependencies(clonedValues);

    const isDirty = this.store.rebuildDirtyState(
      clonedValues,
      this.store.config.initialValues,
    );

    this.store.internalUpdateState(
      {
        values: clonedValues,
        errors: {},
        isValidating: {},
        isValid: true,
        isDirty,
        isSubmitting: false,
      },
      ["*"],
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
    this.replaceValues(mergedValues, "hydrate");
  }

  rebaseValues(newValues: T) {
    const previousValues = this.store.getState().values;
    const clonedValues = deepClone(newValues);

    this.store.config.initialValues = deepClone(clonedValues);

    this.store.cancelAllValidations();
    this.store.evaluateAllDependencies(clonedValues);

    this.store.clearDirtyState();

    this.store.internalUpdateState(
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

    const pipeline = new BitPipelineRunner<SubmitPipelineContext<T>>([
      {
        name: "submit:start",
        run: async (ctx) => {
          this.store.internalUpdateState({ isSubmitting: true });
          ctx.isValid = await this.store.validateNow();
        },
      },
      {
        name: "submit:invalid",
        run: async (ctx) => {
          if (ctx.isValid) return;

          const currentErrors = this.store.getState().errors;
          const newTouched = { ...this.store.getState().touched };

          Object.keys(currentErrors).forEach((path) => {
            newTouched[path as keyof typeof newTouched] = true;
          });

          this.store.internalUpdateState({ touched: newTouched });

          ctx.dirtyValues = this.store.buildDirtyValues(
            this.store.getState().values,
          );
          ctx.invalid = true;

          await this.store.emitAfterSubmit({
            values: this.store.getState().values,
            dirtyValues: ctx.dirtyValues,
            state: this.store.getState(),
            success: false,
            invalid: true,
          });

          ctx.halted = true;
        },
      },
      {
        name: "submit:prepare",
        run: (ctx) => {
          this.store.getHiddenFields().forEach((hiddenPath) => {
            ctx.valuesToSubmit = setDeepValue(
              ctx.valuesToSubmit,
              hiddenPath,
              undefined,
            );
          });

          for (const [path, transformer] of this.store.getTransformEntries()) {
            const currentVal = getDeepValue(ctx.valuesToSubmit, path);
            ctx.valuesToSubmit = setDeepValue(
              ctx.valuesToSubmit,
              path,
              transformer(currentVal, this.store.getState().values),
            );
          }

          ctx.dirtyValues = this.store.buildDirtyValues(ctx.valuesToSubmit);
        },
      },
      {
        name: "submit:before-hooks",
        run: async (ctx) => {
          await this.store.emitBeforeSubmit({
            values: ctx.valuesToSubmit,
            dirtyValues: ctx.dirtyValues,
            state: this.store.getState(),
          });
        },
      },
      {
        name: "submit:user-handler",
        run: async (ctx) => {
          await ctx.onSuccess(ctx.valuesToSubmit, ctx.dirtyValues);
        },
      },
      {
        name: "submit:after-hooks",
        run: async (ctx) => {
          await this.store.emitAfterSubmit({
            values: ctx.valuesToSubmit,
            dirtyValues: ctx.dirtyValues,
            state: this.store.getState(),
            success: true,
          });
        },
      },
    ]);

    try {
      await pipeline.run(context);
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
      this.store.internalUpdateState({ isSubmitting: false });
    }
  }

  reset() {
    this.store.cancelAllValidations();

    const initialCloned = deepClone(this.store.config.initialValues);

    this.store.evaluateAllDependencies(initialCloned);

    this.store.clearDirtyState();

    this.store.internalUpdateState(
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
    );

    this.store.resetHistory(initialCloned);
  }
}
