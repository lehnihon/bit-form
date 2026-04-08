import { getDeepValue } from "../../../../utils";
import type { BitErrors, BitFieldDefinition } from "../../../contracts/types";

type BitAsyncValidateFn<T extends object> = NonNullable<
  NonNullable<BitFieldDefinition<T>["validation"]>["asyncValidate"]
>;

const BIT_ASYNC_VALIDATION_TIMEOUT = Symbol("bit.async.validation.timeout");

export function mergeValidationErrors<T extends object>(args: {
  targetFields?: string[];
  currentErrors: BitErrors<T>;
  allErrors: Record<string, string | undefined>;
  asyncErrors: ReadonlyMap<string, string>;
}) {
  const { targetFields, currentErrors, allErrors, asyncErrors } = args;

  if (targetFields && targetFields.length > 0) {
    let scopedErrors = currentErrors;
    let hasScopedMutation = false;

    const ensureScopedMutable = () => {
      if (!hasScopedMutation) {
        scopedErrors = { ...currentErrors } as BitErrors<T>;
        hasScopedMutation = true;
      }

      return scopedErrors;
    };

    targetFields.forEach((field) => {
      const key = field as keyof BitErrors<T>;
      const currentMessage = currentErrors[key] as string | undefined;

      if (allErrors[field]) {
        if (currentMessage !== allErrors[field]) {
          ensureScopedMutable()[key] = allErrors[field];
        }
      } else if (asyncErrors.has(field)) {
        const asyncMessage = asyncErrors.get(field)!;
        if (currentMessage !== asyncMessage) {
          ensureScopedMutable()[key] = asyncMessage;
        }
      } else {
        if (currentMessage !== undefined) {
          delete ensureScopedMutable()[key];
        }
      }
    });

    const scopedResult = targetFields.every(
      (field) => !allErrors[field] && !asyncErrors.has(field),
    );

    return {
      committedErrors: hasScopedMutation ? scopedErrors : currentErrors,
      result: scopedResult,
      mode: "scoped" as const,
    };
  }

  const globalErrors = {} as BitErrors<T>;

  asyncErrors.forEach((message, path) => {
    globalErrors[path as keyof BitErrors<T>] = message;
  });

  Object.entries(allErrors).forEach(([path, message]) => {
    if (message) {
      globalErrors[path as keyof BitErrors<T>] = message;
    }
  });

  return {
    committedErrors: globalErrors,
    result: undefined,
    mode: "global" as const,
  };
}

export function resolveAsyncValidationPaths<T extends object>(args: {
  targetFields?: string[];
  hiddenFields: ReadonlySet<string>;
  getFieldConfig: (path: string) => BitFieldDefinition<T> | undefined;
  forEachFieldConfig?: (
    callback: (config: BitFieldDefinition<T>, path: string) => void,
  ) => void;
}): string[] {
  const { targetFields, hiddenFields, getFieldConfig, forEachFieldConfig } =
    args;
  const paths: string[] = [];

  if (targetFields && targetFields.length > 0) {
    for (const path of targetFields) {
      if (hiddenFields.has(path)) {
        continue;
      }

      const asyncValidate = getFieldConfig(path)?.validation?.asyncValidate;
      if (asyncValidate) {
        paths.push(path);
      }
    }

    return paths;
  }

  if (!forEachFieldConfig) {
    return paths;
  }

  forEachFieldConfig((config, path) => {
    if (!config.validation?.asyncValidate || hiddenFields.has(path)) {
      return;
    }

    paths.push(path);
  });

  return paths;
}

export async function runImmediateAsyncValidationStage<T extends object>(args: {
  path: string;
  values: T;
  validationId: number;
  getCurrentValidationId: () => number;
  getFieldConfig: (path: string) => BitFieldDefinition<T> | undefined;
  cancelFieldAsync: (path: string) => void;
  createAbortController: () => AbortController;
  setAbortController: (path: string, controller: AbortController) => void;
  clearAbortController: (path: string, controller: AbortController) => boolean;
  setFieldValidating: (path: string, isValidating: boolean) => void;
  setAsyncError: (path: string, message: string) => void;
  clearAsyncError: (path: string) => void;
}) {
  const {
    path,
    values,
    validationId,
    getCurrentValidationId,
    getFieldConfig,
    cancelFieldAsync,
    createAbortController,
    setAbortController,
    clearAbortController,
    setFieldValidating,
    setAsyncError,
    clearAsyncError,
  } = args;

  const asyncValidate = getFieldConfig(path)?.validation?.asyncValidate;

  if (!asyncValidate) {
    clearAsyncError(path);
    return;
  }

  cancelFieldAsync(path);
  clearAsyncError(path);

  const controller = createAbortController();
  setAbortController(path, controller);
  setFieldValidating(path, true);

  try {
    const asyncValidateTimeout =
      getFieldConfig(path)?.validation?.asyncValidateTimeout;

    let validationPromise: Promise<
      string | null | undefined | typeof BIT_ASYNC_VALIDATION_TIMEOUT
    > = (asyncValidate as BitAsyncValidateFn<T>)(
      getDeepValue(values, path),
      values,
    );

    if (typeof asyncValidateTimeout === "number" && asyncValidateTimeout > 0) {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      validationPromise = Promise.race([
        validationPromise,
        new Promise<typeof BIT_ASYNC_VALIDATION_TIMEOUT>((resolve) => {
          timeoutId = setTimeout(
            () => resolve(BIT_ASYNC_VALIDATION_TIMEOUT),
            asyncValidateTimeout,
          );
        }),
      ]).finally(() => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      });
    }

    const errorMessage = await validationPromise;

    if (
      controller.signal.aborted ||
      validationId !== getCurrentValidationId()
    ) {
      return;
    }

    if (errorMessage === BIT_ASYNC_VALIDATION_TIMEOUT) {
      // Timeout is inconclusive: preserve current async error state.
    } else if (errorMessage) {
      setAsyncError(path, errorMessage);
    } else {
      clearAsyncError(path);
    }
  } finally {
    const releasedCurrentController = clearAbortController(path, controller);
    if (releasedCurrentController) {
      setFieldValidating(path, false);
    }
  }
}
