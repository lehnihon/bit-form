import type { BitValidationPipelinePort } from "../../../contracts/port-types";
import { validationCommitOperation } from "../../../engines/operation-engine";
import { hasAnyError } from "../../../shared/error-map";
import type { ValidationPipelineContext } from "./validation-pipeline-context";
import {
  mergeValidationErrors,
  resolveAsyncValidationPaths,
} from "./validation-stages";

export interface BitValidationPipelineStageDeps<T extends object> {
  store: BitValidationPipelinePort<T>;
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
  const rawOptions = ctx.options as
    | { scope?: string; scopeFields?: string[] }
    | undefined;

  if (rawOptions?.scope && rawOptions.scopeFields?.length) {
    deps.store.config.onUnhandledError(
      new Error(
        "validate received both 'scope' and 'scopeFields'. 'scopeFields' takes precedence.",
      ),
      "validation",
    );
    return;
  }

  if (ctx.options?.scopeFields?.length) {
    return;
  }

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
    // NOTE: Do NOT mutate deps.asyncErrors here. The shared asyncErrors Map
    // must survive field visibility toggles. When the field becomes visible again
    // the async error needs to still be present for the next validation commit.
    // Hidden paths are excluded during mergeValidationErrors via the
    // committedErrors merge path — they simply won't appear in the final errors.
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

  const results = await Promise.allSettled(
    targetPaths.map((path) =>
      deps.runImmediateAsyncValidation(
        path,
        ctx.currentState.values,
        ctx.validationId,
      ),
    ),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      deps.store.config.onUnhandledError(result.reason, "validation");
    }
  }
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
    hiddenFields: deps.store.getHiddenFields(),
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
  ctx.result = deps.store.getState().isValid;
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
