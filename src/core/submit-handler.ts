import { extractServerErrors, isValidationErrorShape } from "./utils";

export interface BitSubmitExecutionHandlers {
  onServerErrors: (errors: Record<string, string[] | string>) => void;
  onUnhandledError: (error: Error) => void;
  onSuccess: (result: unknown) => void;
}

export async function executeSubmitHandler<T extends object>(
  handler: (values: T, dirtyValues?: Partial<T>) => Promise<unknown>,
  values: T,
  dirtyValues: Partial<T> | undefined,
  handlers: BitSubmitExecutionHandlers,
): Promise<void> {
  try {
    const result = await handler(values, dirtyValues);
    handlers.onSuccess(result);
  } catch (error) {
    if (isValidationErrorShape(error)) {
      handlers.onServerErrors(extractServerErrors(error));
      return;
    }

    handlers.onUnhandledError(
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}
