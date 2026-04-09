import type { BitServerErrorOptions } from "../../contracts/public/meta-types";
import { BitErrors, BitState } from "../../contracts/types";
import {
  BitStoreOperation,
  patchStateOperation,
} from "../../engines/operation-engine";

/**
 * BitErrorManager
 *
 * Manages error state for fields.
 * Handles setting individual errors, batch errors, and server errors.
 */
export class BitErrorManager<T extends object = Record<string, unknown>> {
  constructor(
    private getState: () => BitState<T>,
    private dispatch: (operation: BitStoreOperation<T>) => void,
    private reportError?: (error: unknown) => void,
  ) {}

  private reportInvalidInput(message: string, details?: unknown) {
    this.reportError?.(
      new Error(
        details === undefined ? message : `${message}: ${String(details)}`,
      ),
    );
  }

  /**
   * Set or clear error for a single field.
   * Pass undefined to clear the error.
   */
  setError(path: string, message: string | undefined): void {
    if (!path || typeof path !== "string") {
      this.reportInvalidInput("setError received an invalid path", path);
      return;
    }

    if (message !== undefined && typeof message !== "string") {
      this.reportInvalidInput("setError received an invalid message", message);
      return;
    }

    const newErrors = {
      ...this.getState().errors,
      [path]: message,
    } as BitErrors<T>;

    if (message === undefined) {
      delete newErrors[path as keyof BitErrors<T>];
    }

    this.dispatch(patchStateOperation({ errors: newErrors }));
  }

  /**
   * Set multiple field errors at once (merge behavior).
   */
  setErrors(errors: BitErrors<T>): void {
    if (!errors || typeof errors !== "object") {
      this.reportInvalidInput("setErrors received an invalid payload");
      return;
    }

    const sanitizedErrors: BitErrors<T> = {};

    Object.entries(errors).forEach(([path, message]) => {
      if (!path) {
        this.reportInvalidInput("setErrors ignored an empty path");
        return;
      }

      if (message !== undefined && typeof message !== "string") {
        this.reportInvalidInput("setErrors ignored a non-string message", path);
        return;
      }

      sanitizedErrors[path as keyof BitErrors<T>] = message;
    });

    this.dispatch(
      patchStateOperation({
        errors: { ...this.getState().errors, ...sanitizedErrors },
      }),
    );
  }

  /**
   * Set errors from server response (converts arrays to first element).
   * Useful for handling 422 validation error responses.
   */
  setServerErrors(
    serverErrors: Record<string, string[] | string>,
    options?: BitServerErrorOptions,
  ): void {
    const arrayStrategy = options?.arrayStrategy ?? "first";
    const joinSeparator = options?.joinSeparator ?? "; ";
    const formattedErrors: BitErrors<T> = {};

    for (const [key, value] of Object.entries(serverErrors)) {
      if (!key) {
        this.reportInvalidInput("setServerErrors ignored an empty path");
        continue;
      }

      if (Array.isArray(value)) {
        const normalizedMessages = value.filter(
          (message): message is string =>
            typeof message === "string" && message.length > 0,
        );

        if (normalizedMessages.length === 0) {
          continue;
        }

        formattedErrors[key as keyof BitErrors<T>] =
          arrayStrategy === "join"
            ? normalizedMessages.join(joinSeparator)
            : normalizedMessages[0];
        continue;
      }

      formattedErrors[key as keyof BitErrors<T>] = value;
    }

    this.setErrors(formattedErrors);
  }
}
