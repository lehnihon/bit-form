import type { BitErrors, BitFieldDefinition } from "../../../contracts/types";
import { getDeepValue } from "../../../../utils";

type BitAsyncValidateFn<T extends object> = NonNullable<
  NonNullable<BitFieldDefinition<T>["validation"]>["asyncValidate"]
>;

export function mergeValidationErrors<T extends object>(args: {
  targetFields?: string[];
  currentErrors: BitErrors<T>;
  allErrors: Record<string, any>;
  asyncErrors: ReadonlyMap<string, string>;
}) {
  const { targetFields, currentErrors, allErrors, asyncErrors } = args;

  if (targetFields && targetFields.length > 0) {
    const scopedErrors = { ...currentErrors } as BitErrors<T>;

    targetFields.forEach((field) => {
      if (allErrors[field]) {
        scopedErrors[field as keyof BitErrors<T>] = allErrors[field];
      } else if (asyncErrors.has(field)) {
        scopedErrors[field as keyof BitErrors<T>] = asyncErrors.get(field)!;
      } else {
        delete scopedErrors[field as keyof BitErrors<T>];
      }
    });

    const scopedResult = targetFields.every(
      (field) => !allErrors[field] && !asyncErrors.has(field),
    );

    return {
      committedErrors: scopedErrors,
      result: scopedResult,
      mode: "scoped" as const,
    };
  }

  const globalErrors = {
    ...Object.fromEntries(asyncErrors.entries()),
    ...allErrors,
  } as BitErrors<T>;

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
  currentValidationId: number;
  getFieldConfig: (path: string) => BitFieldDefinition<T> | undefined;
  cancelFieldAsync: (path: string) => void;
  createAbortController: () => AbortController;
  setAbortController: (path: string, controller: AbortController) => void;
  clearAbortController: (path: string) => void;
  setFieldValidating: (path: string, isValidating: boolean) => void;
  setAsyncError: (path: string, message: string) => void;
  clearAsyncError: (path: string) => void;
}) {
  const {
    path,
    values,
    validationId,
    currentValidationId,
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

  const controller = createAbortController();
  setAbortController(path, controller);
  setFieldValidating(path, true);

  try {
    const errorMessage = await (asyncValidate as BitAsyncValidateFn<T>)(
      getDeepValue(values, path),
      values,
    );

    if (controller.signal.aborted || validationId !== currentValidationId) {
      return;
    }

    if (errorMessage) {
      setAsyncError(path, errorMessage);
    } else {
      clearAsyncError(path);
    }
  } finally {
    if (!controller.signal.aborted && validationId === currentValidationId) {
      setFieldValidating(path, false);
    }
    clearAbortController(path);
  }
}
