import { ObjectSchema } from "joi";
import { BitErrors } from "../core";
import { filterErrorsByScope, setFirstError } from "./utils";

export const joiResolver = <T extends object>(schema: ObjectSchema<T>) => {
  return async (
    values: T,
    options?: { scopeFields?: string[] },
  ): Promise<BitErrors<T>> => {
    // Para validação parcial, o Joi precisa ignorar campos desconhecidos no objeto de valores
    const { error } = schema.validate(values, {
      abortEarly: false,
      allowUnknown: true,
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
