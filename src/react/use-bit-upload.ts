/**
 * React Hook for File Upload Integration
 *
 * Minimal upload API integrated with global field validation lifecycle.
 *
 * @example
 * ```typescript
 * const avatar = useBitUpload("avatar", uploadFn);
 *
 * return (
 *   <>
 *     <input
 *       type="file"
 *       onChange={(e) => avatar.upload(e.target.files?.[0])}
 *       disabled={avatar.isValidating}
 *     />
 *     {avatar.error && <Error>{avatar.error}</Error>}
 *   </>
 * );
 * ```
 */

import { useCallback, useRef } from "react";
import { useBitField } from "./use-bit-field";
import { useBitStore } from "./context";
import { BitUploadFn, UseBitUploadOptions } from "../core/upload/types";
import { performUpload } from "../core/upload";

export interface UseBitUploadResult {
  value: string | File | null;
  setValue: (value: string | File | null) => void;
  error?: string;
  isValidating: boolean;
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
  const uploadKeyRef = useRef<string | null>(null);

  const upload = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;

      store.beginFieldValidation(fieldPath);
      await store.clearFieldAsyncError(fieldPath);

      try {
        const result = await performUpload(file, uploadFn, {
          uploadOptions: options?.uploadOptions,
        });

        field.setValue(result.url);
        uploadKeyRef.current = result.key;
        await store.clearFieldAsyncError(fieldPath);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed";
        await store.setFieldAsyncError(fieldPath, message);
      } finally {
        store.endFieldValidation(fieldPath);
      }
    },
    [uploadFn, field, fieldPath, options, store],
  );

  const remove = useCallback(async () => {
    const uploadKey = uploadKeyRef.current;

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
    uploadKeyRef.current = null;
    await store.clearFieldAsyncError(fieldPath);
  }, [options, field, fieldPath, store]);

  return {
    value: field.value,
    setValue: field.setValue,
    error: field.meta?.error,
    isValidating: field.meta?.isValidating || false,
    upload,
    remove,
  };
}
