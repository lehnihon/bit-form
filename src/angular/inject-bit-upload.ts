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
  BitUploadAdapter,
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
  uploadProgress: import("@angular/core").Signal<BitUploadProgress | undefined>;
  uploadError: import("@angular/core").Signal<string | undefined>;
  uploadKey: import("@angular/core").Signal<string | undefined>;

  // Actions
  handleUploadFile: (file: File | null | undefined) => Promise<void>;
  handleRemoveFile: () => Promise<void>;
}

export function injectBitUpload(
  fieldPath: string,
  adapter: BitUploadAdapter,
  options?: UseBitUploadOptions,
): InjectBitUploadResult {
  const field = injectBitField(fieldPath);

  const isUploading = signal(false);
  const uploadProgress = signal<BitUploadProgress | undefined>(undefined);
  const uploadError = signal<string | undefined>(undefined);
  const uploadKey = signal<string | undefined>(undefined);

  const handleUploadFile = async (file: File | null | undefined) => {
    if (!file) return;

    isUploading.set(true);
    uploadError.set(undefined);
    uploadProgress.set(undefined);

    try {
      const result = await performUpload(file, adapter, {
        folder: options?.uploadOptions?.folder,
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
    if (uploadKey() && adapter.delete) {
      try {
        await adapter.delete(uploadKey()!);
        field.setValue(null);
        uploadKey.set(undefined);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Delete failed";
        uploadError.set(message);
      }
    } else {
      field.setValue(null);
      uploadKey.set(undefined);
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
