import type { ScopeStatus } from "../contracts/types";

export function areStepErrorsEqual(
  currentErrors: Record<string, string>,
  nextErrors: Record<string, string>,
): boolean {
  const currentKeys = Object.keys(currentErrors);
  const nextKeys = Object.keys(nextErrors);

  if (currentKeys.length !== nextKeys.length) {
    return false;
  }

  return currentKeys.every((key) => currentErrors[key] === nextErrors[key]);
}

export function isStepStatusEqual(
  currentStatus: ScopeStatus,
  nextStatus: ScopeStatus,
): boolean {
  return (
    currentStatus.hasErrors === nextStatus.hasErrors &&
    currentStatus.isDirty === nextStatus.isDirty &&
    areStepErrorsEqual(currentStatus.errors, nextStatus.errors)
  );
}

export function getStepSubscriptionPaths(scopeFields: readonly string[]) {
  return [...scopeFields, "isDirty"];
}

export function getStepRegistrySubscriptionPath(scopeName: string) {
  return `__scope__.${scopeName}`;
}
