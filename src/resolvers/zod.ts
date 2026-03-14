import { ZodError, ZodSchema } from "zod";
import { BitErrors } from "../core";
import { filterErrorsByScope, setFirstError } from "./utils";

export const zodResolver = <T extends object>(schema: ZodSchema<T>) => {
  return async (
    values: T,
    options?: { scopeFields?: string[] },
  ): Promise<BitErrors<T>> => {
    try {
      await schema.parseAsync(values);
      return {};
    } catch (error: unknown) {
      const errors: BitErrors<T> = {};

      if (error instanceof ZodError) {
        for (const issue of error.issues) {
          const path = issue.path.join(".");
          setFirstError(errors, path, issue.message);
        }
      }

      return filterErrorsByScope(errors, options?.scopeFields);
    }
  };
};
