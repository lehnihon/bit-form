import type { BitErrors, BitFieldChangeMeta } from "../../../contracts/types";
import { getDeepValue, setDeepValue } from "../../../../utils";
import {
  BitPipelineContext,
  BitSyncPipelineRunner,
} from "../../../shared/pipeline";
import { patchStateOperation } from "../../../engines/operation-engine";
import type { BitLifecycleStorePort } from "../../../contracts/port-types";
import type { BitDependencyUpdateDiff } from "../../../contracts/port-types";

interface FieldUpdatePipelineContext<
  T extends object,
> extends BitPipelineContext {
  path: string;
  value: any;
  meta: BitFieldChangeMeta;
  previousValue: unknown;
  nextValues: T;
  nextErrors: BitErrors<T>;
  hasMutatedErrors: boolean;
  dependencyDiff: BitDependencyUpdateDiff;
  isDirty: boolean;
}

export class BitFieldUpdateManager<T extends object> {
  private readonly fieldUpdatePipeline: BitSyncPipelineRunner<
    FieldUpdatePipelineContext<T>
  >;
  private readonly reusableContext: FieldUpdatePipelineContext<T> = {
    path: "",
    value: undefined,
    meta: { origin: "setField" },
    previousValue: undefined,
    nextValues: {} as T,
    nextErrors: {} as BitErrors<T>,
    hasMutatedErrors: false,
    dependencyDiff: {
      affectedFields: [],
      visibilityChanged: [],
      requiredChanged: [],
    },
    isDirty: false,
  };
  private isReusableContextBusy = false;

  constructor(private readonly store: BitLifecycleStorePort<T>) {
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
  }

  updateField(
    path: string,
    value: any,
    meta: BitFieldChangeMeta = { origin: "setField" },
  ) {
    const state = this.store.getState();
    const context = this.acquireContext();

    context.path = path;
    context.value = value;
    context.meta = meta;
    context.previousValue = getDeepValue(state.values, path);
    context.nextValues = setDeepValue(state.values, path, value);
    context.nextErrors = state.errors;
    context.hasMutatedErrors = false;
    context.dependencyDiff.affectedFields.length = 0;
    context.dependencyDiff.visibilityChanged.length = 0;
    context.dependencyDiff.requiredChanged.length = 0;
    context.isDirty = false;

    const isReusableContext = context === this.reusableContext;
    if (isReusableContext) {
      this.isReusableContextBusy = true;
    }

    try {
      this.fieldUpdatePipeline.run(context);
    } finally {
      if (isReusableContext) {
        this.isReusableContextBusy = false;
      }
    }
  }

  private acquireContext(): FieldUpdatePipelineContext<T> {
    if (!this.isReusableContextBusy) {
      return this.reusableContext;
    }

    return {
      path: "",
      value: undefined,
      meta: { origin: "setField" },
      previousValue: undefined,
      nextValues: {} as T,
      nextErrors: {} as BitErrors<T>,
      hasMutatedErrors: false,
      dependencyDiff: {
        affectedFields: [],
        visibilityChanged: [],
        requiredChanged: [],
      },
      isDirty: false,
    };
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
    if (
      typeof this.store.hasDependentFields === "function" &&
      !this.store.hasDependentFields(ctx.path)
    ) {
      ctx.dependencyDiff.affectedFields.length = 0;
      ctx.dependencyDiff.visibilityChanged.length = 0;
      ctx.dependencyDiff.requiredChanged.length = 0;
      return;
    }

    ctx.dependencyDiff = this.store.updateDependencies(
      ctx.path,
      this.store.getState().values,
      ctx.nextValues,
    );

    const fieldsToReset = new Set([
      ...ctx.dependencyDiff.visibilityChanged,
      ...ctx.dependencyDiff.requiredChanged,
    ]);

    fieldsToReset.forEach((depPath) => {
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
        return;
      }

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
    });
  }

  private updateDirtyState(ctx: FieldUpdatePipelineContext<T>) {
    ctx.isDirty = this.store.updateDirtyForPath(
      ctx.path,
      ctx.nextValues,
      this.store.getBaselineValues(),
    );
  }

  private commitFieldState(ctx: FieldUpdatePipelineContext<T>) {
    const changedPaths = Array.from(
      new Set([
        ctx.path,
        ...ctx.dependencyDiff.visibilityChanged,
        ...ctx.dependencyDiff.requiredChanged,
      ]),
    );

    this.store.dispatch(
      patchStateOperation(
        {
          values: ctx.nextValues,
          errors: ctx.nextErrors,
          isDirty: ctx.isDirty,
        },
        changedPaths,
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
    const validationTargets = Array.from(
      new Set([
        ctx.path,
        ...ctx.dependencyDiff.visibilityChanged,
        ...ctx.dependencyDiff.requiredChanged,
      ]),
    );

    if (
      this.store.config.resolver ||
      ctx.dependencyDiff.visibilityChanged.length > 0 ||
      ctx.dependencyDiff.requiredChanged.length > 0
    ) {
      this.store.triggerValidation(validationTargets);
    }
  }

  private triggerAsyncValidation(ctx: FieldUpdatePipelineContext<T>) {
    const asyncValidateOn =
      typeof this.store.getFieldConfig === "function"
        ? this.store.getFieldConfig(ctx.path)?.validation?.asyncValidateOn
        : undefined;

    if (asyncValidateOn !== "change") {
      return;
    }

    this.store.handleFieldAsyncValidation(ctx.path, ctx.value);
  }
}
