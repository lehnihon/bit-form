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
  BitUploadAdapter,
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
  uploadProgress: Ref<BitUploadProgress | undefined>;
  uploadError: Ref<string | undefined>;
  uploadKey: Ref<string | undefined>;

  // Actions
  handleUploadFile: (file: File | null | undefined) => Promise<void>;
  handleRemoveFile: () => Promise<void>;
}

export function useBitUpload(
  fieldPath: string,
  adapter: BitUploadAdapter,
  options?: UseBitUploadOptions,
): UseBitUploadResult {
  const field = useBitField(fieldPath);

  const isUploading = ref(false);
  const uploadProgress = ref<BitUploadProgress | undefined>(undefined);
  const uploadError = ref<string | undefined>(undefined);
  const uploadKey = ref<string | undefined>(undefined);

  const handleUploadFile = async (file: File | null | undefined) => {
    if (!file) return;

    isUploading.value = true;
    uploadError.value = undefined;
    uploadProgress.value = undefined;

    try {
      const result = await performUpload(file, adapter, {
        folder: options?.uploadOptions?.folder,
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
    if (uploadKey.value && adapter.delete) {
      try {
        await adapter.delete(uploadKey.value);
        field.setValue(null);
        uploadKey.value = undefined;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Delete failed";
        uploadError.value = message;
      }
    } else {
      field.setValue(null);
      uploadKey.value = undefined;
    }
  };

  return {
    value: field.value,
    setValue: field.setValue,
    error: field.error,
    isValidating: computed(() => field.meta.value.isValidating || false),
    isUploading,
    uploadProgress,
    uploadError,
    uploadKey,
    handleUploadFile,
    handleRemoveFile,
  };
}
