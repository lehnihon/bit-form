import { ZodSchema } from 'zod';
import { V as ValidatorFn } from '../bit-store-ZXigSRPy.js';

declare const zodResolver: <T extends Record<string, any>>(schema: ZodSchema<T>) => ValidatorFn<T>;

export { zodResolver };
