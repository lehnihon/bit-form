import { AnyObject, ObjectSchema } from 'yup';
import { ValidatorFn } from '../core/bit-store';

export const yupResolver = <T extends AnyObject>(schema: ObjectSchema<T>): ValidatorFn<T> => {
  return async (values: T) => {
    try {
      await schema.validate(values, { abortEarly: false });
      return {};
    } catch (yupError: any) {
      const errors: Record<string, string> = {};
      yupError.inner.forEach((error: any) => {
        if (error.path && !errors[error.path]) {
          errors[error.path] = error.message;
        }
      });
      return errors;
    }
  };
};