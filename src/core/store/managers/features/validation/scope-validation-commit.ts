import { getDeepValue, valueEqual } from "../../../../utils";
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
  const initialHiddenFields = new Set(store.getHiddenFields());
  const resolverErrors = store.config.resolver
    ? await store.config.resolver(initialState.values, {
        scopeFields,
      })
    : {};

  // Capture current state AFTER async operations to avoid stale state
  const currentState = store.getState();

  // Guard: if any of the scope fields' values changed, abort to prevent overwriting newer validation.
  // Uses getDeepValue so that nested paths (e.g. "address.street", "items.0.name") are correctly
  // compared — direct bracket access (`values[field]`) always returns undefined for dot-separated
  // paths, making the guard a no-op and allowing stale errors to overwrite current ones.
  const valuesStale = scopeFields.some(
    (field) =>
      !valueEqual(
        getDeepValue(initialState.values, field),
        getDeepValue(currentState.values, field),
      ),
  );
  const currentHiddenFields = store.getHiddenFields();
  const visibilityStale = scopeFields.some(
    (field) =>
      initialHiddenFields.has(field) !== currentHiddenFields.has(field),
  );

  if (valuesStale || visibilityStale) {
    // A scoped field value changed during resolver execution; newer validations may be in flight
    // Skip this commit to avoid race condition
    return;
  }

  const dynamicRequiredErrors = store.getRequiredErrors(currentState.values);
  const allErrors = { ...resolverErrors, ...dynamicRequiredErrors };

  currentHiddenFields.forEach((hiddenPath) => {
    delete allErrors[hiddenPath];
    // NOTE: Do NOT delete from asyncErrors here — same contract as validation-pipeline-stages.
    // The shared asyncErrors Map must not lose entries for temporarily hidden paths.
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
    validationCommitOperation(
      scopedErrors,
      !hasAnyError(scopedErrors) &&
        !hasAnyError(currentState.errors as Record<string, unknown>),
    ),
  );
}
