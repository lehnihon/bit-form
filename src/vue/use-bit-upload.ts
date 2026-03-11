/**
 * Vue Composition API for File Upload
 *
 * Minimal upload API integrated with global field validation lifecycle.
 */

import { computed, ComputedRef } from "vue";
import { useBitField } from "./use-bit-field";
import { useBitStore } from "./context";
import { BitUploadFn, UseBitUploadOptions } from "../core/upload/types";
import { performUpload } from "../core/upload";

export interface UseBitUploadResult {
  value: ComputedRef<string | File | null>;
  setValue: (value: string | File | null) => void;
  error: ComputedRef<string | undefined>;
  isValidating: ComputedRef<boolean>;
  upload: (file: File | null | undefined) => Promise<void>;
  remove: () => Promise<void>;
}

export function useBitUpload(
  fieldPath: string,
  uploadFn: BitUploadFn,
  options?: UseBitUploadOptions,
): UseBitUploadResult {
  const store = useBitStore<any>();
  const field = useBitField(fieldPath);
  let uploadKey: string | null = null;

  const upload = async (file: File | null | undefined) => {
    if (!file) return;

    store.beginFieldValidation(fieldPath);
    await store.clearFieldAsyncError(fieldPath);

    try {
      const result = await performUpload(file, uploadFn, {
        uploadOptions: options?.uploadOptions,
      });

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
    if (uploadKey && options?.deleteFile) {
      try {
        await options.deleteFile(uploadKey);
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
    value: field.value as ComputedRef<string | File | null>,
    setValue: field.setValue,
    error: computed(() => field.meta.error.value),
    isValidating: computed(() => field.meta.isValidating.value || false),
    upload,
    remove,
  };
}
