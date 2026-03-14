/**
 * Vue Composition API for File Upload
 *
 * Minimal upload API integrated with global field validation lifecycle.
 */

import { computed, ComputedRef, ref } from "vue";
import { useBitField } from "./use-bit-field";
import { useBitStore } from "./context";
import { BitUploadFn, BitDeleteUploadFn } from "../core";
import type { UseBitUploadResult } from "./types";

export function useBitUpload(
  fieldPath: string,
  uploadFn: BitUploadFn,
  deleteFile?: BitDeleteUploadFn,
): UseBitUploadResult {
  const store = useBitStore<any>();
  const field = useBitField(fieldPath);
  let uploadKey: string | null = null;
  const isUploading = ref(false);

  const upload = async (file: File | null | undefined) => {
    if (!file) return;

    isUploading.value = true;
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
      isUploading.value = false;
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
    value: field.value as ComputedRef<string | File | null>,
    setValue: field.setValue,
    error: computed(() => field.meta.error.value),
    isValidating: computed(
      () => !!field.meta.isValidating.value || isUploading.value,
    ),
    upload,
    remove,
  };
}
