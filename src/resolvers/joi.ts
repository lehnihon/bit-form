import { ObjectSchema } from "joi";
import { BitErrors } from "../core/store/types";

export const joiResolver = <T extends object>(schema: ObjectSchema<T>) => {
  return async (values: T): Promise<BitErrors<T>> => {
    const { error } = schema.validate(values, { abortEarly: false });

    if (!error) return {};

    const errors: BitErrors<T> = {};

    error.details.forEach((detail) => {
      const path = detail.path.join(".");

      if (path && !errors[path]) {
        errors[path] = detail.message;
      }
    });

    return errors;
  };
};
