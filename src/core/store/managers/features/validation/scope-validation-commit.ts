import type { BitErrors } from "../../../contracts/types";
import type { BitValidationStorePort } from "../../../contracts/port-types";
import { validationCommitOperation } from "../../../engines/operation-engine";
import { hasAnyError } from "../../../shared/error-map";

export async function commitSynchronousScopeValidation<T extends object>(args: {
  scopeFields: string[];
  store: BitValidationStorePort<T>;
  asyncErrors: Map<string, string>;
}) {
  const { scopeFields, store, asyncErrors } = args;
  const currentState = store.getState();
  const resolverErrors = store.config.resolver
    ? await store.config.resolver(currentState.values, {
        scopeFields,
      })
    : {};

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

  store.dispatch(validationCommitOperation(scopedErrors, !hasAnyError(scopedErrors)));
}
