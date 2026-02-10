import { ZodSchema } from 'zod';
import { ValidatorFn } from '../core/bit-store';

export const zodResolver = <T extends Record<string, any>>(schema: ZodSchema<T>): ValidatorFn<T> => {
  return (values: T) => {
    const result = schema.safeParse(values);
    
    if (result.success) return {};

    const errors: Partial<Record<keyof T, string>> = {};
    
    for (const issue of result.error.issues) {
      const path = issue.path[0] as keyof T;
      if (path) {
        errors[path] = issue.message;
      }
    }

    return errors;
  };
};