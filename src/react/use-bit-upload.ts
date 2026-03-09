/**
 * React Hook for File Upload Integration
 *
 * Combines useBitField with file upload management.
 * Automatically validates completion of upload before form submission.
 *
 * @example
 * ```typescript
 * const avatar = useBitUpload("avatar", s3Adapter, {
 *   onProgress: (p) => setProgress(p.percentage),
 *   uploadOptions: { folder: "avatars" },
 * });
 *
 * return (
 *   <>
 *     <input
 *       type="file"
 *       onChange={(e) => avatar.handleUploadFile(e.target.files?.[0])}
 *       disabled={avatar.isUploading}
 *     />
 *     {avatar.isUploading && <ProgressBar value={avatar.uploadProgress?.percentage} />}
 *     {avatar.uploadError && <Error>{avatar.uploadError}</Error>}
 *   </>
 * );
 * ```
 */

import { useState, useCallback } from "react";
import { useBitField } from "./use-bit-field";
import {
  BitUploadAdapter,
  BitUploadProgress,
  UseBitUploadOptions,
} from "../core/upload/types";
import { performUpload } from "../core/upload";

export interface UseBitUploadResult {
  // Field integration
  value: string | File | null;
  setValue: (value: string | File | null) => void;
  error?: string;
  isValidating: boolean;
  meta: any;
  props: any;

  // Upload specifics
  isUploading: boolean;
  uploadProgress: BitUploadProgress;
  uploadError: string | null;
  uploadKey: string | null;

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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<BitUploadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0,
  });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadKey, setUploadKey] = useState<string | null>(null);

  const handleUploadFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;

      setIsUploading(true);
      setUploadError(null);
      setUploadProgress({ loaded: 0, total: 0, percentage: 0 });

      try {
        const result = await performUpload(file, adapter, {
          folder: options?.uploadOptions?.folder,
          onProgress: (progress) => {
            setUploadProgress(progress);
            options?.onProgress?.(progress);
          },
          onError: (error) => {
            setUploadError(error.message);
            options?.onError?.(error);
          },
        });

        // Update field with file URL
        field.setValue(result.url);
        setUploadKey(result.key);
        options?.onSuccess?.(result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed";
        setUploadError(message);
      } finally {
        setIsUploading(false);
      }
    },
    [adapter, field, options],
  );

  const handleRemoveFile = useCallback(async () => {
    if (uploadKey && adapter.delete) {
      try {
        await adapter.delete(uploadKey);
        field.setValue(null);
        setUploadKey(null);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Delete failed";
        setUploadError(message);
      }
    } else {
      field.setValue(null);
      setUploadKey(null);
    }
  }, [uploadKey, adapter, field]);

  return {
    // Delegate field properties
    value: field.value,
    setValue: field.setValue,
    error: field.meta?.error,
    isValidating: field.meta?.isValidating || false,
    meta: field.meta,
    props: field.props,

    // Upload state
    isUploading,
    uploadProgress,
    uploadError,
    uploadKey,

    // Actions
    handleUploadFile,
    handleRemoveFile,
  };
}
