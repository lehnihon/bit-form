/**
 * Angular Dependency Injection for File Upload
 *
 * Minimal upload API integrated with global field validation lifecycle.
 */

import { computed, inject, signal } from "@angular/core";
import type { BitDeleteUploadFn, BitUploadFn } from "../core";
import { createRemoveHandler, createUploadHandler } from "../core/adapters";
import { injectBitField } from "./inject-bit-field";
import { BIT_STORE_TOKEN } from "./provider";
import type { InjectBitUploadResult } from "./types";

export function injectBitUpload<
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  fieldPath: string,
  uploadFn: BitUploadFn<TMetadata>,
  deleteFile?: BitDeleteUploadFn,
): InjectBitUploadResult {
  const store = inject(BIT_STORE_TOKEN);
  const field = injectBitField(fieldPath);
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
    value: computed(() => field.value()),
    setValue: field.setValue,
    error: computed(() => field.meta.error()),
    isValidating: computed(() => !!field.meta.isValidating() || isUploading()),
    upload,
    remove,
  };
}
