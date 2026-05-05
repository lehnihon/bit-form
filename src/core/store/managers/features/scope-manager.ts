import { BitErrors, BitState } from "../../contracts/types";

/**
 * BitScopeManager
 *
 * Manages multi-scope forms and scope-based validation.
 * Scopes are groups of fields that can be validated and tracked independently,
 * useful for wizard-style forms or multi-section forms.
 */
export class BitScopeManager<T extends object = Record<string, unknown>> {
  constructor(
    private getState: () => BitState<T>,
    private getInitialValues: () => T,
    private getScopeFields: (scopeName: string) => string[],
    private isPathDirty: (path: string) => boolean,
  ) {}

  /**
   * Get validation status of a scope.
   * Returns whether the scope has errors, is dirty, and the error details.
   */
  getScopeStatus(scopeName: string) {
    if (!scopeName) {
      return { hasErrors: false, isDirty: false, errors: {} };
    }

    const fields = this.getScopeFields(scopeName);
    if (fields.length === 0) {
      return { hasErrors: false, isDirty: false, errors: {} };
    }

    const state = this.getState();

    const hasErrors = fields.some(
      (f) => !!state.errors[f as keyof BitErrors<T>],
    );

    const isDirty = fields.some((f) => this.isPathDirty(f));

    const errors = this.getScopeErrors(scopeName);

    return { hasErrors, isDirty, errors };
  }

  /**
   * Get all errors for fields in a specific scope.
   */
  getScopeErrors(scopeName: string): Record<string, string> {
    const fields = this.getScopeFields(scopeName);
    const state = this.getState();
    const result: Record<string, string> = {};

    for (const field of fields) {
      const error = state.errors[field as keyof BitErrors<T>];
      if (error) {
        result[field] = error;
      }
    }

    return result;
  }
}
