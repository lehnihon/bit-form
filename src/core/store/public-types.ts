import {
  BitErrors,
  BitPath,
  BitPathValue,
  BitResolvedConfig,
  BitState,
} from "./types";
import { BitMask } from "../mask/types";

export interface BitPublicStore<T extends object = any> {
  getConfig(): Readonly<BitResolvedConfig<T>>;
  getState(): Readonly<BitState<T>>;
  subscribe(listener: () => void): () => void;

  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>): void;
  blurField<P extends BitPath<T>>(path: P): void;
  setValues(values: T): void;

  setError(path: string, message: string | undefined): void;
  setErrors(errors: BitErrors<T>): void;
  setServerErrors(serverErrors: Record<string, string[] | string>): void;

  validate(options?: {
    scope?: string;
    scopeFields?: string[];
  }): Promise<boolean>;

  reset(): void;

  submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ): Promise<void>;

  registerMask(name: string, mask: BitMask): void;
  getDirtyValues(): Partial<T>;

  cleanup(): void;
}
