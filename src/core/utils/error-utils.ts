import type { BitErrors } from "../store/contracts/types";

/**
 * Helper to safely clear an error from an errors object.
 * Returns a tuple of [newErrors, hasMutatedErrors] indicating if the error was cleared
 * and whether a clone was needed.
 */
export function clearErrorPath<T extends object>(
  errors: BitErrors<T>,
  path: string,
  alreadyMutated: boolean,
): [BitErrors<T>, boolean] {
  const hasError = Object.prototype.hasOwnProperty.call(errors, path);

  if (!hasError) {
    return [errors, alreadyMutated];
  }

  let nextErrors = errors;
  let hasMutated = alreadyMutated;

  if (!hasMutated) {
    nextErrors = { ...errors };
    hasMutated = true;
  }

  delete nextErrors[path as keyof BitErrors<T>];

  return [nextErrors, hasMutated];
}

/**
 * Check if an error exists for a path.
 */
export function hasErrorPath<T extends object>(
  errors: BitErrors<T>,
  path: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(errors, path);
}
