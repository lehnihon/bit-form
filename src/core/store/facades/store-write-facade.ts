import type {
  BitErrors,
  BitFieldChangeMeta,
  BitPath,
  BitPathValue,
  BitSubmitResult,
  DeepPartial,
} from "../contracts/types";
import { touchFieldsOperation } from "../engines/operation-engine";
import type { BitStoreRuntimeKernel } from "../orchestration/store-runtime-kernel";

export class BitStoreWriteFacade<T extends object> {
  constructor(private readonly runtime: BitStoreRuntimeKernel<T>) {}

  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>): void {
    this.setFieldWithMeta(path as string, value, { origin: "setField" });
  }

  private setFieldWithMeta(
    path: string,
    value: unknown,
    meta: BitFieldChangeMeta = { origin: "setField" },
  ): void {
    this.runtime.runBatch(() => {
      this.runtime.capabilities.lifecycle.updateField(path, value, meta);
    });
  }

  blurField<P extends BitPath<T>>(path: P): void {
    this.runtime.saveHistorySnapshot();

    if (!this.runtime.capabilities.query.isTouched(path as string)) {
      this.runtime.runBatch(() => {
        this.runtime.dispatch(touchFieldsOperation([path as string]));
      });
    }

    this.runtime.capabilities.validation.trigger([path]);
  }

  markFieldsTouched(paths: string[]): void {
    if (paths.length === 0) return;
    this.runtime.dispatch(touchFieldsOperation(paths));
  }

  setValues(
    values: T | DeepPartial<T>,
    options?: { partial?: boolean; rebase?: boolean },
  ): void {
    this.runtime.capabilities.lifecycle.setValues(values, options);
  }

  setError(path: string, message: string | undefined): void {
    this.runtime.capabilities.error.setError(path, message);
  }

  setErrors(errors: BitErrors<T>): void {
    this.runtime.capabilities.error.setErrors(errors);
  }

  setServerErrors(serverErrors: Record<string, string[] | string>): void {
    this.runtime.capabilities.error.setServerErrors(serverErrors);
  }

  reset(): void {
    this.runtime.capabilities.lifecycle.reset();
  }

  transaction<TResult>(callback: () => TResult): TResult {
    return this.runtime.runBatch(callback);
  }

  async submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ): Promise<BitSubmitResult> {
    return this.runtime.capabilities.lifecycle.submit(onSuccess);
  }
}
