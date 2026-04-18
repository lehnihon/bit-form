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

import { useMemo, useRef, useState } from "react";
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

  // Ref que sempre aponta para os valores mais recentes de render,
  // permitindo que o handler factory (e seu `currentGeneration`) seja
  // criado uma única vez por (fieldPath, uploadFn). Sem este padrão,
  // qualquer re-render que gere nova referência de callbacks zeraria
  // `currentGeneration` e perderia silenciosamente a URL de upload.
  const callbacksRef = useRef({
    setLoading: setIsUploading,
    setError: (path: string, msg: string | undefined) =>
      store.write.setError(path, msg),
    setValue: (val: string | null) => setValue(val as any),
    getUploadKey: () => uploadKeyRef.current,
    setUploadKey: (key: string | null) => {
      uploadKeyRef.current = key;
    },
    onCallbackError: (e: unknown) =>
      store.read.config.onUnhandledError(e, "upload"),
  });
  // Mantém os closures da ref atualizados a cada render sem recriar o objeto.
  callbacksRef.current.setLoading = setIsUploading;
  callbacksRef.current.setError = (path, msg) =>
    store.write.setError(path, msg);
  callbacksRef.current.setValue = (val) => setValue(val as any);
  callbacksRef.current.onCallbackError = (e) =>
    store.read.config.onUnhandledError(e, "upload");

  const stableCallbacks = useMemo(
    () => ({
      setLoading: (val: boolean) => callbacksRef.current.setLoading(val),
      setError: (path: string, msg: string | undefined) =>
        callbacksRef.current.setError(path, msg),
      setValue: (val: string | null) => callbacksRef.current.setValue(val),
      getUploadKey: () => callbacksRef.current.getUploadKey(),
      setUploadKey: (key: string | null) =>
        callbacksRef.current.setUploadKey(key),
      onCallbackError: (e: unknown) =>
        callbacksRef.current.onCallbackError?.(e),
    }),
    [], // estável para todo o lifetime do componente
  );

  const upload = useMemo(
    () => createUploadHandler(fieldPath, uploadFn, stableCallbacks),
    [fieldPath, uploadFn, stableCallbacks],
  );

  const remove = useMemo(
    () => createRemoveHandler(fieldPath, deleteFile, stableCallbacks),
    [fieldPath, deleteFile, stableCallbacks],
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
