import { ZodSchema } from 'zod';
import { BitErrors } from '../core/bit-store';

export const zodResolver = <T extends object>(schema: ZodSchema<T>) => {
  return async (values: T): Promise<BitErrors<T>> => {
    const result = await schema.safeParseAsync(values);
    
    if (result.success) return {};

    const errors: BitErrors<T> = {};
    
    for (const issue of result.error.issues) {
      const path = issue.path.join('.');
      
      if (path && !errors[path]) {
        errors[path] = issue.message;
      }
    }

    return errors;
  };
};