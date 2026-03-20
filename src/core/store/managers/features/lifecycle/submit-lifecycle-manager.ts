import { deepClone, getDeepValue, setDeepValues } from "../../../../utils";
import {
  BitPipelineContext,
  BitPipelineRunner,
} from "../../../shared/pipeline";
import { patchStateOperation } from "../../../engines/operation-engine";
import type { BitLifecycleStorePort } from "../../../contracts/port-types";

interface SubmitPipelineContext<T extends object> extends BitPipelineContext {
  onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>;
  isValid: boolean;
  valuesToSubmit: T;
  dirtyValues: Partial<T>;
  error?: unknown;
  invalid?: boolean;
}

export class BitSubmitLifecycleManager<T extends object> {
  private readonly submitPipeline: BitPipelineRunner<SubmitPipelineContext<T>>;

  constructor(private readonly store: BitLifecycleStorePort<T>) {
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
