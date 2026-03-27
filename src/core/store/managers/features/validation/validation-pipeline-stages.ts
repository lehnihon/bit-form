import type { BitValidationStorePort } from "../../../contracts/port-types";
import type { ValidationPipelineContext } from "./validation-pipeline-context";
import { hasAnyError } from "../../../shared/error-map";
import { validationCommitOperation } from "../../../engines/operation-engine";
import {
  mergeValidationErrors,
  resolveAsyncValidationPaths,
} from "./validation-stages";

export interface BitValidationPipelineStageDeps<T extends object> {
  store: BitValidationStorePort<T>;
  asyncErrors: Map<string, string>;
  getCurrentValidationId: () => number;
  runImmediateAsyncValidation: (
    path: string,
    values: T,
    validationId: number,
  ) => Promise<void>;
}

export function resolveTargetFieldsStage<T extends object>(args: {
  ctx: ValidationPipelineContext<T>;
  deps: BitValidationPipelineStageDeps<T>;
}) {
  const { ctx, deps } = args;
  if (ctx.options?.scope) {
    const scopeFields = deps.store.getScopeFields(ctx.options.scope);
    if (scopeFields.length > 0) {
      ctx.targetFields = scopeFields;
    }
  }
}

export async function runBeforeValidateHooksStage<T extends object>(args: {
  ctx: ValidationPipelineContext<T>;
  deps: BitValidationPipelineStageDeps<T>;
}) {
  const { ctx, deps } = args;

  await deps.store.emitBeforeValidate({
    values: ctx.currentState.values,
    state: ctx.currentState,
    scope: ctx.options?.scope,
    scopeFields: ctx.targetFields,
  });
}

export async function runSynchronousTrackStage<T extends object>(args: {
  ctx: ValidationPipelineContext<T>;
  deps: BitValidationPipelineStageDeps<T>;
}) {
  const { ctx, deps } = args;

  const resolverErrors = deps.store.config.resolver
    ? await deps.store.config.resolver(ctx.currentState.values, {
        scopeFields: ctx.targetFields,
      })
    : {};

  const dynamicRequiredErrors = deps.store.getRequiredErrors(
    ctx.currentState.values,
  );

  ctx.allErrors = { ...resolverErrors, ...dynamicRequiredErrors };

  deps.store.getHiddenFields().forEach((hiddenPath) => {
    delete ctx.allErrors[hiddenPath];
    deps.asyncErrors.delete(hiddenPath);
  });
}

export async function runAsyncTrackStage<T extends object>(args: {
  ctx: ValidationPipelineContext<T>;
  deps: BitValidationPipelineStageDeps<T>;
}) {
  const { ctx, deps } = args;

  const targetPaths = resolveAsyncValidationPaths<T>({
    targetFields: ctx.targetFields,
    hiddenFields: deps.store.getHiddenFields(),
    getFieldConfig: (path) => deps.store.getFieldConfig(path),
    forEachFieldConfig: deps.store.forEachFieldConfig,
  });

  if (targetPaths.length === 0) {
    return;
  }

  await Promise.all(
    targetPaths.map((path) =>
      deps.runImmediateAsyncValidation(
        path,
        ctx.currentState.values,
        ctx.validationId,
      ),
    ),
  );
}

export function mergeAsyncTrackStage<T extends object>(args: {
  ctx: ValidationPipelineContext<T>;
  deps: BitValidationPipelineStageDeps<T>;
}) {
  const { ctx, deps } = args;

  const merged = mergeValidationErrors<T>({
    targetFields: ctx.targetFields,
    currentErrors: ctx.currentState.errors,
    allErrors: ctx.allErrors,
    asyncErrors: deps.asyncErrors,
  });

  ctx.committedErrors = merged.committedErrors;
  ctx.isValid = !hasAnyError(merged.committedErrors);
  ctx.result = merged.mode === "scoped" ? merged.result : ctx.isValid;
}

export async function abortIfOutdatedStage<T extends object>(args: {
  ctx: ValidationPipelineContext<T>;
  deps: BitValidationPipelineStageDeps<T>;
}) {
  const { ctx, deps } = args;
  if (ctx.validationId === deps.getCurrentValidationId()) {
    return;
  }

  ctx.aborted = true;
  ctx.result = ctx.currentState.isValid;
  ctx.halted = true;
}

export async function commitValidationStage<T extends object>(args: {
  ctx: ValidationPipelineContext<T>;
  deps: BitValidationPipelineStageDeps<T>;
}) {
  const { ctx, deps } = args;

  deps.store.dispatch(
    validationCommitOperation(ctx.committedErrors, ctx.isValid),
  );

  await deps.store.emitAfterValidate({
    values: deps.store.getState().values,
    state: deps.store.getState(),
    scope: ctx.options?.scope,
    scopeFields: ctx.targetFields,
    errors: ctx.committedErrors,
    result: ctx.result,
  });

  ctx.halted = true;
}
