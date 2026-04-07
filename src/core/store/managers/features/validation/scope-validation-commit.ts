import type { BitValidationPipelinePort } from "../../../contracts/port-types";
import type { BitErrors } from "../../../contracts/types";
import { validationCommitOperation } from "../../../engines/operation-engine";
import { hasAnyError } from "../../../shared/error-map";

export async function commitSynchronousScopeValidation<T extends object>(args: {
  scopeFields: string[];
  store: BitValidationPipelinePort<T>;
  asyncErrors: Map<string, string>;
}) {
  const { scopeFields, store, asyncErrors } = args;
  const initialState = store.getState();
  const resolverErrors = store.config.resolver
    ? await store.config.resolver(initialState.values, {
        scopeFields,
      })
    : {};

  // Capture current state AFTER async operations to avoid stale state
  const currentState = store.getState();

  // Guard: if values changed significantly, abort to prevent overwriting newer validation
  const valuesStale = !Object.is(initialState.values, currentState.values);
  if (valuesStale) {
    // Values changed during resolver execution; newer validations may be in flight
    // Skip this commit to avoid race condition
    return;
  }

  const dynamicRequiredErrors = store.getRequiredErrors(currentState.values);
  const allErrors = { ...resolverErrors, ...dynamicRequiredErrors };

  store.getHiddenFields().forEach((hiddenPath) => {
    delete allErrors[hiddenPath];
    asyncErrors.delete(hiddenPath);
  });

  const scopedErrors = { ...currentState.errors } as BitErrors<T>;

  scopeFields.forEach((field) => {
    if (allErrors[field]) {
      scopedErrors[field as keyof BitErrors<T>] = allErrors[field];
    } else if (asyncErrors.has(field)) {
      scopedErrors[field as keyof BitErrors<T>] = asyncErrors.get(field)!;
    } else {
      delete scopedErrors[field as keyof BitErrors<T>];
    }
  });

  store.dispatch(
    validationCommitOperation(scopedErrors, !hasAnyError(scopedErrors)),
  );
}
