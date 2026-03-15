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

import { useCallback, useRef, useState } from "react";
import { useBitField } from "./use-bit-field";
import { useBitStore } from "./context";
import { BitUploadFn, BitDeleteUploadFn } from "../core";
import { createUploadHandler, createRemoveHandler } from "../core/adapters";
import type { UseBitUploadResult } from "./types";

export function useBitUpload(
  fieldPath: string,
  uploadFn: BitUploadFn,
  deleteFile?: BitDeleteUploadFn,
): UseBitUploadResult {
  const store = useBitStore<any>();
  const field = useBitField(fieldPath);
  const uploadKeyRef = useRef<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const kernelCallbacks = {
    setLoading: setIsUploading,
    setError: (path: string, msg: string | undefined) =>
      store.setError(path, msg),
    setValue: (val: string | null) => field.setValue(val as any),
    getUploadKey: () => uploadKeyRef.current,
    setUploadKey: (key: string | null) => {
      uploadKeyRef.current = key;
    },
  };

  const upload = useCallback(
    createUploadHandler(fieldPath, uploadFn, kernelCallbacks),
    [uploadFn, field, fieldPath, store],
  );

  const remove = useCallback(
    createRemoveHandler(fieldPath, deleteFile, kernelCallbacks),
    [deleteFile, field, fieldPath, store],
  );

  return {
    value: field.value,
    setValue: field.setValue,
    error: field.meta?.error,
    isValidating: !!field.meta?.isValidating || isUploading,
    upload,
    remove,
  };
}
