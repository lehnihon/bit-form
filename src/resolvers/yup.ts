import { ValidationError } from "yup";
import { BitErrors } from "../core/bit-store";

export const yupResolver = <T extends object>(schema: any) => {
  return (values: T): Promise<BitErrors<T>> => {
    return schema
      .validate(values, { abortEarly: false })
      .then(() => ({}))
      .catch((err: any) => {
        if (err.name === "ValidationError" || err instanceof ValidationError) {
          const errors: BitErrors<T> = {};

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
      });
  };
};
