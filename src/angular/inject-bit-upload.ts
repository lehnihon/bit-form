/**
 * Angular Dependency Injection for File Upload
 *
 * Signal-based file upload integration for Angular.
 *
 * @example
 * ```typescript
 * export class MyComponent {
 *   avatar = injectBitUpload("avatar", s3Adapter, {
 *     uploadOptions: { folder: "avatars" },
 *   });
 *
 *   constructor() {
 *     effect(() => {
 *       if (this.avatar.uploadError()) {
 *         console.error(this.avatar.uploadError());
 *       }
 *     });
 *   }
 *
 *   async onFileSelect(event: Event) {
 *     const file = (event.target as HTMLInputElement).files?.[0];
 *     await this.avatar.handleUploadFile(file);
 *   }
 * }
 * ```
 */

import { signal, computed } from "@angular/core";
import { injectBitField } from "./inject-bit-field";
import {
  BitUploadFn,
  BitUploadProgress,
  UseBitUploadOptions,
} from "../core/upload/types";
import { performUpload } from "../core/upload";

export interface InjectBitUploadResult {
  // Field integration (signals)
  value: import("@angular/core").Signal<string | File | null>;
  setValue: (value: string | File | null) => void;
  error: import("@angular/core").Signal<string | undefined>;
  isValidating: import("@angular/core").Signal<boolean>;

  // Upload signals
  isUploading: import("@angular/core").Signal<boolean>;
  uploadProgress: import("@angular/core").Signal<BitUploadProgress>;
  uploadError: import("@angular/core").Signal<string | null>;
  uploadKey: import("@angular/core").Signal<string | null>;

  // Actions
  handleUploadFile: (file: File | null | undefined) => Promise<void>;
  handleRemoveFile: () => Promise<void>;
}

export function injectBitUpload(
  fieldPath: string,
  uploadFn: BitUploadFn,
  options?: UseBitUploadOptions,
): InjectBitUploadResult {
  const field = injectBitField(fieldPath);

  const isUploading = signal(false);
  const uploadProgress = signal<BitUploadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0,
  });
  const uploadError = signal<string | null>(null);
  const uploadKey = signal<string | null>(null);

  const handleUploadFile = async (file: File | null | undefined) => {
    if (!file) return;

    isUploading.set(true);
    uploadError.set(null);
    uploadProgress.set({ loaded: 0, total: 0, percentage: 0 });

    try {
      const result = await performUpload(file, uploadFn, {
        uploadOptions: options?.uploadOptions,
        onProgress: (progress) => {
          uploadProgress.set(progress);
          options?.onProgress?.(progress);
        },
        onError: (error) => {
          uploadError.set(error.message);
          options?.onError?.(error);
        },
      });

      field.setValue(result.url);
      uploadKey.set(result.key);
      options?.onSuccess?.(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      uploadError.set(message);
    } finally {
      isUploading.set(false);
    }
  };

  const handleRemoveFile = async () => {
    if (uploadKey() && options?.deleteFile) {
      try {
        await options.deleteFile(uploadKey()!);
        field.setValue(null);
        uploadKey.set(null);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Delete failed";
        uploadError.set(message);
      }
    } else {
      field.setValue(null);
      uploadKey.set(null);
    }
  };

  return {
    value: computed(() => field.value()),
    setValue: field.setValue,
    error: computed(() => field.meta.error()),
    isValidating: computed(() => field.meta.isValidating() || false),
    isUploading,
    uploadProgress,
    uploadError,
    uploadKey,
    handleUploadFile,
    handleRemoveFile,
  };
}
