import { ObjectSchema } from "joi";
import { BitErrors } from "../core";
import { filterErrorsByScope, setFirstError } from "./utils";
import { BitJoiResolverConfig, BitResolverScopeOptions } from "./types";

export const joiResolver = <T extends object>(
  schema: ObjectSchema<T>,
  config?: BitJoiResolverConfig,
) => {
  return async (
    values: T,
    options?: BitResolverScopeOptions,
  ): Promise<BitErrors<T>> => {
    const { error } = schema.validate(values, {
      abortEarly: config?.abortEarly ?? false,
      allowUnknown: config?.allowUnknown ?? false,
      stripUnknown: config?.stripUnknown ?? false,
    });

    if (!error) return {};

    const errors: BitErrors<T> = {};

    error.details.forEach((detail) => {
      const path = detail.path.join(".");

      setFirstError(errors, path, detail.message);
    });

    return filterErrorsByScope(errors, options?.scopeFields);
  };
};
