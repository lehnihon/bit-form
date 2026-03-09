/**
 * Vue Composition API for File Upload
 *
 * Composable for file upload integration.
 *
 * @example
 * ```typescript
 * export default {
 *   setup() {
 *     const avatar = useBitUpload("avatar", s3Adapter, {
 *       uploadOptions: { folder: "avatars" },
 *     });
 *
 *     return { avatar };
 *   },
 * };
 * ```
 */

import { ref, computed, Ref, ComputedRef } from "vue";
import { useBitField } from "./use-bit-field";
import {
  BitUploadFn,
  BitUploadProgress,
  UseBitUploadOptions,
} from "../core/upload/types";
import { performUpload } from "../core/upload";

export interface UseBitUploadResult {
  // Field integration (refs)
  value: ComputedRef<string | File | null>;
  setValue: (value: string | File | null) => void;
  error: ComputedRef<string | undefined>;
  isValidating: ComputedRef<boolean>;

  // Upload refs
  isUploading: Ref<boolean>;
  uploadProgress: Ref<BitUploadProgress>;
  uploadError: Ref<string | null>;
  uploadKey: Ref<string | null>;

  // Actions
  handleUploadFile: (file: File | null | undefined) => Promise<void>;
  handleRemoveFile: () => Promise<void>;
}

export function useBitUpload(
  fieldPath: string,
  uploadFn: BitUploadFn,
  options?: UseBitUploadOptions,
): UseBitUploadResult {
  const field = useBitField(fieldPath);

  const isUploading = ref(false);
  const uploadProgress = ref<BitUploadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0,
  });
  const uploadError = ref<string | null>(null);
  const uploadKey = ref<string | null>(null);

  const handleUploadFile = async (file: File | null | undefined) => {
    if (!file) return;

    isUploading.value = true;
    uploadError.value = null;
    uploadProgress.value = { loaded: 0, total: 0, percentage: 0 };

    try {
      const result = await performUpload(file, uploadFn, {
        uploadOptions: options?.uploadOptions,
        onProgress: (progress) => {
          uploadProgress.value = progress;
          options?.onProgress?.(progress);
        },
        onError: (error) => {
          uploadError.value = error.message;
          options?.onError?.(error);
        },
      });

      field.setValue(result.url);
      uploadKey.value = result.key;
      options?.onSuccess?.(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      uploadError.value = message;
    } finally {
      isUploading.value = false;
    }
  };

  const handleRemoveFile = async () => {
    if (uploadKey.value && options?.deleteFile) {
      try {
        await options.deleteFile(uploadKey.value);
        field.setValue(null);
        uploadKey.value = null;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Delete failed";
        uploadError.value = message;
      }
    } else {
      field.setValue(null);
      uploadKey.value = null;
    }
  };

  return {
    value: field.value as ComputedRef<string | File | null>,
    setValue: field.setValue,
    error: computed(() => field.meta.error.value),
    isValidating: computed(() => field.meta.isValidating.value || false),
    isUploading,
    uploadProgress,
    uploadError,
    uploadKey,
    handleUploadFile,
    handleRemoveFile,
  };
}
