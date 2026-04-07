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
import type {
  BitDeleteUploadFn,
  BitFrameworkStoreApi,
  BitStoreApi,
  BitUploadFn,
} from "../core";
import { createRemoveHandler, createUploadHandler } from "../core/adapters";
import { resolveReactStore } from "./store";
import type { UseBitUploadResult } from "./types";
import { useBitField } from "./use-bit-field";

export function useBitUpload<
  TForm extends object = any,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  storeInput: BitFrameworkStoreApi<TForm> | BitStoreApi<TForm>,
  fieldPath: string,
  uploadFn: BitUploadFn<TMetadata>,
  deleteFile?: BitDeleteUploadFn,
): UseBitUploadResult {
  const store = resolveReactStore(storeInput);
  const field = useBitField(store, fieldPath as any);
  const uploadKeyRef = useRef<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const kernelCallbacks = {
    setLoading: setIsUploading,
    setError: (path: string, msg: string | undefined) =>
      store.write.setError(path, msg),
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
    value: field.value as any,
    setValue: field.setValue as any,
    error: field.meta?.error,
    isValidating: !!field.meta?.isValidating || isUploading,
    upload,
    remove,
  };
}
