import { ObjectSchema } from 'joi';
import { ValidatorFn } from '../core/bit-store';

export const joiResolver = <T>(schema: ObjectSchema<T>): ValidatorFn<T> => {
  return (values: T) => {
    const { error } = schema.validate(values, { abortEarly: false });
    
    if (!error) return {};

    const errors: Record<string, string> = {};
    error.details.forEach((detail) => {
      const path = detail.path[0] as string;
      if (path && !errors[path]) {
        errors[path] = detail.message;
      }
    });
    
    return errors;
  };
};