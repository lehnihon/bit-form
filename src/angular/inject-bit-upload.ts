/**
 * Angular Dependency Injection for File Upload
 *
 * Minimal upload API integrated with global field validation lifecycle.
 */

import { computed, inject } from "@angular/core";
import { BIT_STORE_TOKEN } from "./provider";
import { injectBitField } from "./inject-bit-field";
import { BitUploadFn, BitDeleteUploadFn } from "../core";

export interface InjectBitUploadResult {
  value: import("@angular/core").Signal<string | File | null>;
  setValue: (value: string | File | null) => void;
  error: import("@angular/core").Signal<string | undefined>;
  isValidating: import("@angular/core").Signal<boolean>;
  upload: (file: File | null | undefined) => Promise<void>;
  remove: () => Promise<void>;
}

export function injectBitUpload(
  fieldPath: string,
  uploadFn: BitUploadFn,
  deleteFile?: BitDeleteUploadFn,
): InjectBitUploadResult {
  const store = inject(BIT_STORE_TOKEN);
  const field = injectBitField(fieldPath);
  let uploadKey: string | null = null;

  const upload = async (file: File | null | undefined) => {
    if (!file) return;

    store.beginFieldValidation(fieldPath);
    await store.clearFieldAsyncError(fieldPath);

    try {
      const result = await uploadFn(file);

      field.setValue(result.url);
      uploadKey = result.key;
      await store.clearFieldAsyncError(fieldPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      await store.setFieldAsyncError(fieldPath, message);
    } finally {
      store.endFieldValidation(fieldPath);
    }
  };

  const remove = async () => {
    if (uploadKey && deleteFile) {
      try {
        await deleteFile(uploadKey);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Delete failed";
        await store.setFieldAsyncError(fieldPath, message);
        return;
      }
    }

    field.setValue(null);
    uploadKey = null;
    await store.clearFieldAsyncError(fieldPath);
  };

  return {
    value: computed(() => field.value()),
    setValue: field.setValue,
    error: computed(() => field.meta.error()),
    isValidating: computed(() => field.meta.isValidating() || false),
    upload,
    remove,
  };
}
