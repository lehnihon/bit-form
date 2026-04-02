/**
 * Vue Composition API for File Upload
 *
 * Minimal upload API integrated with global field validation lifecycle.
 */

import { computed, ComputedRef, ref } from "vue";
import type { BitDeleteUploadFn, BitUploadFn } from "../core";
import { createRemoveHandler, createUploadHandler } from "../core/adapters";
import { useBitStore } from "./context";
import type { UseBitUploadResult } from "./types";
import { useBitField } from "./use-bit-field";

export function useBitUpload<
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  fieldPath: string,
  uploadFn: BitUploadFn<TMetadata>,
  deleteFile?: BitDeleteUploadFn,
): UseBitUploadResult {
  const store = useBitStore<any>();
  const field = useBitField(fieldPath);
  let uploadKey: string | null = null;
  const isUploading = ref(false);

  const kernelCallbacks = {
    setLoading: (val: boolean) => {
      isUploading.value = val;
    },
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
