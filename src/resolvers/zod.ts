import { ZodSchema } from "zod";
import { BitErrors } from "../core";

export const zodResolver = <T extends object>(schema: ZodSchema<T>) => {
  return async (
    values: T,
    options?: { scopeFields?: string[] },
  ): Promise<BitErrors<T>> => {
    try {
      await schema.parseAsync(values);
      return {};
    } catch (err: any) {
      const errors: BitErrors<T> = {};

      if (err.issues) {
        err.issues.forEach((issue: any) => {
          const path = issue.path.join(".");
          if (path && !errors[path]) {
            errors[path] = issue.message;
          }
        });
      }

      if (options?.scopeFields && options.scopeFields.length > 0) {
        const scopeSet = new Set(options.scopeFields);
        const filtered: BitErrors<T> = {};
        for (const [key, msg] of Object.entries(errors)) {
          if (scopeSet.has(key) && msg) filtered[key as keyof BitErrors<T>] = msg;
        }
        return filtered;
      }

      return errors;
    }
  };
};
