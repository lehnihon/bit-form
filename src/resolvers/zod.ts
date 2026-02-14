import { ZodSchema } from "zod";
import { BitErrors } from "../core/store/types";

export const zodResolver = <T extends object>(schema: ZodSchema<T>) => {
  return async (
    values: T,
    options?: { scopeFields?: string[] },
  ): Promise<BitErrors<T>> => {
    try {
      let targetSchema = schema;

      if (options?.scopeFields && options.scopeFields.length > 0) {
        // Filtra o schema para validar apenas os campos necessários
        const mask: any = {};
        options.scopeFields.forEach((field) => (mask[field] = true));
        // Nota: .pick() funciona em ZodObject. Se for outro tipo, valida tudo como fallback.
        if ((schema as any).pick) {
          targetSchema = (schema as any).pick(mask);
        }
      }

      await targetSchema.parseAsync(values);
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

      return errors;
    }
  };
};
