import { BitErrors, BitState } from "../../contracts/types";
import { getDeepValue, valueEqual } from "../../../utils";

/**
 * BitScopeManager
 *
 * Manages multi-step forms and scope-based validation.
 * Scopes are groups of fields that can be validated and tracked independently,
 * useful for wizard-style forms or multi-section forms.
 */
export class BitScopeManager<T extends object = any> {
  constructor(
    private getState: () => BitState<T>,
    private getInitialValues: () => T,
    private getScopeFields: (scopeName: string) => string[],
  ) {}

  /**
   * Get validation status of a scope (step).
   * Returns whether the scope has errors, is dirty, and the error details.
   */
  getStepStatus(scopeName: string) {
    const fields = this.getScopeFields(scopeName);
    const state = this.getState();

    const hasErrors = fields.some(
      (f) => !!state.errors[f as keyof BitErrors<T>],
    );

    const isDirty = fields.some((f) => {
      const current = getDeepValue(state.values, f);
      const initial = getDeepValue(this.getInitialValues(), f);
      return !valueEqual(current, initial);
    });

    const errors = this.getStepErrors(scopeName);

    return { hasErrors, isDirty, errors };
  }

  /**
   * Get all errors for fields in a specific scope.
   */
  getStepErrors(scopeName: string): Record<string, string> {
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
