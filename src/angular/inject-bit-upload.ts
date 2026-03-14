/**
 * Angular Dependency Injection for File Upload
 *
 * Minimal upload API integrated with global field validation lifecycle.
 */

import { computed, inject, signal } from "@angular/core";
import { BIT_STORE_TOKEN } from "./provider";
import { injectBitField } from "./inject-bit-field";
import { BitUploadFn, BitDeleteUploadFn } from "../core";
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

  const upload = async (file: File | null | undefined) => {
    if (!file) return;

    isUploading.set(true);
    store.setError(fieldPath, undefined);

    try {
      const result = await uploadFn(file);

      field.setValue(result.url);
      uploadKey = result.key;
      store.setError(fieldPath, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      store.setError(fieldPath, message);
    } finally {
      isUploading.set(false);
    }
  };

  const remove = async () => {
    if (uploadKey && deleteFile) {
      try {
        await deleteFile(uploadKey);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Delete failed";
        store.setError(fieldPath, message);
        return;
      }
    }

    field.setValue(null);
    uploadKey = null;
    store.setError(fieldPath, undefined);
  };

  return {
    value: computed(() => field.value()),
    setValue: field.setValue,
    error: computed(() => field.meta.error()),
    isValidating: computed(() => !!field.meta.isValidating() || isUploading()),
    upload,
    remove,
  };
}
