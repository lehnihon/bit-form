import {
  deepClone,
  extractServerErrors,
  isValidationErrorShape,
  setDeepValues,
} from "../../../../utils";
import type { BitLifecycleSubmitPort } from "../../../contracts/port-types";
import type { BitSubmitResult } from "../../../contracts/types";
import { patchStateOperation } from "../../../engines/operation-engine";
import {
  BitPipelineContext,
  BitPipelineRunner,
} from "../../../shared/pipeline";
import { applyTransformDerivations } from "../../../shared/value-derivation-pipeline";

interface SubmitPipelineContext<T extends object> extends BitPipelineContext {
  onSuccess: (
    values: T,
    dirtyValues?: Partial<T>,
  ) => unknown | Promise<unknown>;
  isValid: boolean;
  valuesToSubmit: T;
  dirtyValues: Partial<T>;
  error?: unknown;
  invalid?: boolean;
}

export class BitSubmitLifecycleManager<T extends object> {
  private readonly submitPipeline: BitPipelineRunner<SubmitPipelineContext<T>>;

  constructor(private readonly store: BitLifecycleSubmitPort<T>) {
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

  async submit(
    onSuccess: (
      values: T,
      dirtyValues?: Partial<T>,
    ) => unknown | Promise<unknown>,
  ): Promise<BitSubmitResult> {
    const currentState = this.store.getState();

    if (currentState.isSubmitting) {
      return { status: "blocked", reason: "isSubmitting" };
    }

    if (this.store.hasValidationsInProgress()) {
      return { status: "blocked", reason: "validating" };
    }

    this.store.cancelAllValidations();

    const context: SubmitPipelineContext<T> = {
      onSuccess,
      isValid: false,
      valuesToSubmit: deepClone(this.store.getState().values),
      dirtyValues: {},
    };

    try {
      await this.submitPipeline.run(context);

      if (context.invalid) {
        return { status: "invalid" };
      }

      return { status: "submitted" };
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

      this.store.config.onUnhandledError(error, "submit");

      return { status: "failed", error };
    } finally {
      this.store.dispatch(patchStateOperation({ isSubmitting: false }));
    }
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
    const hiddenFields = this.store.getHiddenFields();

    hiddenFields.forEach((hiddenPath) => {
      updates.push([hiddenPath, undefined]);
    });

    if (updates.length > 0) {
      ctx.valuesToSubmit = setDeepValues(ctx.valuesToSubmit, updates);
    }

    ctx.valuesToSubmit = applyTransformDerivations({
      values: ctx.valuesToSubmit,
      sourceValues: ctx.valuesToSubmit,
      transformEntries: this.store
        .getTransformEntries()
        .filter(([path]) => !hiddenFields.has(path)),
      onError: (error) => {
        throw error;
      },
    });

    ctx.dirtyValues = this.store.buildDirtyValues(ctx.valuesToSubmit);
  }

  private async runBeforeSubmitHooks(ctx: SubmitPipelineContext<T>) {
    // Hooks recebem um snapshot de submissão imutável por contrato.
    // Mudanças no estado global durante o hook não alteram valuesToSubmit.
    await this.store.emitBeforeSubmit({
      values: ctx.valuesToSubmit,
      dirtyValues: ctx.dirtyValues,
      state: this.store.getState(),
    });
  }

  private async runSubmitHandler(ctx: SubmitPipelineContext<T>) {
    try {
      await ctx.onSuccess(ctx.valuesToSubmit, ctx.dirtyValues);
    } catch (error) {
      if (isValidationErrorShape(error)) {
        this.store.setServerErrors(extractServerErrors(error));

        await this.store.emitAfterSubmit({
          values: ctx.valuesToSubmit,
          dirtyValues: ctx.dirtyValues,
          state: this.store.getState(),
          success: false,
          invalid: true,
        });

        ctx.invalid = true;
        ctx.halted = true;
        return;
      }

      throw error;
    }
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
