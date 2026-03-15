import { BitErrors, BitState } from "../../contracts/types";

/**
 * BitErrorManager
 *
 * Manages error state for fields.
 * Handles setting individual errors, batch errors, and server errors.
 */
export class BitErrorManager<T extends object = any> {
  constructor(
    private getState: () => BitState<T>,
    private internalUpdateState: (partial: Partial<BitState<T>>) => void,
  ) {}

  /**
   * Set or clear error for a single field.
   * Pass undefined to clear the error.
   */
  setError(path: string, message: string | undefined): void {
    const newErrors = {
      ...this.getState().errors,
      [path]: message,
    } as BitErrors<T>;

    if (!message) {
      delete newErrors[path as keyof BitErrors<T>];
    }

    this.internalUpdateState({ errors: newErrors });
  }

  /**
   * Set multiple field errors at once (merge behavior).
   */
  setErrors(errors: BitErrors<T>): void {
    this.internalUpdateState({
      errors: { ...this.getState().errors, ...errors },
    });
  }

  /**
   * Set errors from server response (converts arrays to first element).
   * Useful for handling 422 validation error responses.
   */
  setServerErrors(serverErrors: Record<string, string[] | string>): void {
    const formattedErrors: BitErrors<T> = {};

    for (const [key, value] of Object.entries(serverErrors)) {
      formattedErrors[key as keyof BitErrors<T>] = Array.isArray(value)
        ? value[0]
        : value;
    }

    this.setErrors(formattedErrors);
  }
}
