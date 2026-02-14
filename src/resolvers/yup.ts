import { ValidationError, Schema } from "yup";
import { BitErrors } from "../core/store/types";

export const yupResolver = <T extends object>(schema: Schema<any>) => {
  return async (
    values: T,
    options?: { scopeFields?: string[] },
  ): Promise<BitErrors<T>> => {
    const errors: BitErrors<T> = {};

    if (options?.scopeFields && options.scopeFields.length > 0) {
      await Promise.all(
        options.scopeFields.map(async (field) => {
          try {
            await schema.validateAt(field, values);
          } catch (err: any) {
            if (err.name === "ValidationError" && err.path) {
              const normalizedPath = err.path.replace(/\[(\d+)\]/g, ".$1");
              errors[normalizedPath] = err.message;
            }
          }
        }),
      );
      return errors;
    }

    try {
      await schema.validate(values, { abortEarly: false });
      return {};
    } catch (err: any) {
      if (err.name === "ValidationError" || err instanceof ValidationError) {
        err.inner?.forEach((error: any) => {
          if (error.path) {
            const normalizedPath = error.path.replace(/\[(\d+)\]/g, ".$1");
            if (!errors[normalizedPath]) {
              errors[normalizedPath] = error.message;
            }
          }
        });
        return errors;
      }
      return {};
    }
  };
};
