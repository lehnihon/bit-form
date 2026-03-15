/**
 * Angular Dependency Injection for File Upload
 *
 * Minimal upload API integrated with global field validation lifecycle.
 */

import { computed, inject, signal } from "@angular/core";
import { BIT_STORE_TOKEN } from "./provider";
import { injectBitField } from "./inject-bit-field";
import { BitUploadFn, BitDeleteUploadFn } from "../core";
import { createUploadHandler, createRemoveHandler } from "../core/adapters";
import type { InjectBitUploadResult } from "./types";

export function injectBitUpload(
  fieldPath: string,
  uploadFn: BitUploadFn,
  deleteFile?: BitDeleteUploadFn,
): InjectBitUploadResult {
  const store = inject(BIT_STORE_TOKEN);
  const field = injectBitField(fieldPath);
  let uploadKey: string | null = null;
  const isUploading = signal(false);

  const kernelCallbacks = {
    setLoading: (val: boolean) => isUploading.set(val),
    setError: (path: string, msg: string | undefined) =>
      store.setError(path, msg),
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
