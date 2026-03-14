import { ValidationError, Schema } from "yup";
import { BitErrors } from "../core";
import {
  filterErrorsByScope,
  normalizeErrorPath,
  setFirstError,
} from "./utils";
import { BitResolverScopeOptions, BitYupResolverConfig } from "./types";

export const yupResolver = <T extends object>(
  schema: Schema<T>,
  config?: BitYupResolverConfig,
) => {
  return async (
    values: T,
    options?: BitResolverScopeOptions,
  ): Promise<BitErrors<T>> => {
    const errors: BitErrors<T> = {};

    if (options?.scopeFields && options.scopeFields.length > 0) {
      await Promise.all(
        options.scopeFields.map(async (field) => {
          try {
            await schema.validateAt(field, values);
          } catch (error: unknown) {
            if (error instanceof ValidationError && error.path) {
              setFirstError(
                errors,
                normalizeErrorPath(error.path),
                error.message,
              );
            }
          }
        }),
      );
      return errors;
    }

    try {
      await schema.validate(values, {
        abortEarly: config?.abortEarly ?? false,
        stripUnknown: config?.stripUnknown ?? false,
      });
      return {};
    } catch (error: unknown) {
      if (error instanceof ValidationError) {
        for (const item of error.inner ?? []) {
          if (item.path) {
            setFirstError(errors, normalizeErrorPath(item.path), item.message);
          }
        }

        return filterErrorsByScope(errors, options?.scopeFields);
      }

      return {};
    }
  };
};
