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
            await schema.validateAt(field, values, {
              abortEarly: config?.abortEarly ?? false,
            });
          } catch (error: unknown) {
            if (error instanceof ValidationError) {
              if (error.inner && error.inner.length > 0) {
                for (const item of error.inner) {
                  if (item.path) {
                    setFirstError(errors, normalizeErrorPath(item.path), item.message);
                  }
                }
              } else if (error.path) {
                setFirstError(errors, normalizeErrorPath(error.path), error.message);
              }
            } else {
              throw error;
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

      throw error;
    }
  };
};
