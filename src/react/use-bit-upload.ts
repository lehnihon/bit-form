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

import { useCallback, useMemo, useRef, useState } from "react";
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
  const { value, setValue, meta } = field;
  const error = meta?.error;
  const fieldIsValidating = !!meta?.isValidating;
  const uploadKeyRef = useRef<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const kernelCallbacks = useMemo(
    () => ({
      setLoading: setIsUploading,
      setError: (path: string, msg: string | undefined) =>
        store.write.setError(path, msg),
      setValue: (val: string | null) => setValue(val as any),
      getUploadKey: () => uploadKeyRef.current,
      setUploadKey: (key: string | null) => {
        uploadKeyRef.current = key;
      },
      onCallbackError: (e: unknown) => store.read.config.onUnhandledError(e, "upload"),
    }),
    [store, setValue],
  );

  const upload = useCallback(
    createUploadHandler(fieldPath, uploadFn, kernelCallbacks),
    [fieldPath, uploadFn, kernelCallbacks],
  );

  const remove = useCallback(
    createRemoveHandler(fieldPath, deleteFile, kernelCallbacks),
    [fieldPath, deleteFile, kernelCallbacks],
  );

  return useMemo(
    () => ({
      value,
      setValue,
      error,
      isValidating: fieldIsValidating || isUploading,
      upload,
      remove,
    }),
    [value, setValue, error, fieldIsValidating, isUploading, upload, remove],
  );
}
