/**
 * Angular Dependency Injection for File Upload
 *
 * Minimal upload API integrated with global field validation lifecycle.
 */

import { computed, signal } from "@angular/core";
import type {
  BitDeleteUploadFn,
  BitFrameworkStoreApi,
  BitStoreApi,
  BitUploadFn,
} from "../core";
import { createRemoveHandler, createUploadHandler } from "../core/adapters";
import { injectBitField } from "./inject-bit-field";
import { resolveAngularStore } from "./store";
import type { InjectBitUploadResult } from "./types";

export function injectBitUpload<
  TForm extends object = any,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  storeInput: BitFrameworkStoreApi<TForm> | BitStoreApi<TForm>,
  fieldPath: string,
  uploadFn: BitUploadFn<TMetadata>,
  deleteFile?: BitDeleteUploadFn,
): InjectBitUploadResult {
  const store = resolveAngularStore(storeInput);
  const field = injectBitField(store, fieldPath as any);
  let uploadKey: string | null = null;
  const isUploading = signal(false);

  const kernelCallbacks = {
    setLoading: (val: boolean) => isUploading.set(val),
    setError: (path: string, msg: string | undefined) =>
      store.write.setError(path, msg),
    setValue: (val: string | null) => field.setValue(val),
    getUploadKey: () => uploadKey,
    setUploadKey: (key: string | null) => {
      uploadKey = key;
    },
  };

  const upload = createUploadHandler(fieldPath, uploadFn, kernelCallbacks);
  const remove = createRemoveHandler(fieldPath, deleteFile, kernelCallbacks);

  return {
    value: computed(() => field.value()) as any,
    setValue: field.setValue as any,
    error: computed(() => field.meta.error()),
    isValidating: computed(() => !!field.meta.isValidating() || isUploading()),
    upload,
    remove,
  };
}
