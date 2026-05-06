/**
 * Framework-agnostic upload kernel.
 *
 * Encapsulates the side-effect logic for uploading/removing files so that
 * React, Vue, and Angular adapters share a single implementation and only
 * differ in how they wire reactive state.
 */

import type { BitDeleteUploadFn, BitUploadFn } from "../types/upload";

export interface UploadKernelCallbacks {
  /** Called with `true` when upload starts and `false` when it finishes. */
  setLoading: (loading: boolean) => void;
  /** Set or clear a field-level error message. */
  setError: (path: string, message: string | undefined) => void;
  /** Set the stored file URL after a successful upload (or `null` on remove). */
  setValue: (value: string | null) => void;
  /** Return the key of the last uploaded file (used when deleting). */
  getUploadKey: () => string | null;
  /** Persist the upload key returned by the upload function. */
  setUploadKey: (key: string | null) => void;
  /**
   * Called when a state-update callback (setValue, setLoading, etc.) throws.
   * Defaults to a no-op if not provided, but callers should route this to the
   * store's `onUnhandledError` to surface issues in observability tools.
   */
  onCallbackError?: (error: unknown) => void;
}

/**
 * Creates a type-safe `upload` handler for a field.
 *
 * @example
 * ```ts
 * const upload = createUploadHandler("avatar", myUploadFn, {
 *   setLoading: (v) => (isUploading.value = v),
 *   setError:   (p, m) => store.setError(p, m),
 *   setValue:   (v) => field.setValue(v),
 *   getUploadKey: () => uploadKey,
 *   setUploadKey: (k) => (uploadKey = k),
 *   onCallbackError: (e) => store.config.onUnhandledError(e, "upload"),
 * });
 * ```
 */
function safeCallbackExecution(fn: () => void, onError?: (e: unknown) => void): void {
  try {
    fn();
  } catch (error) {
    if (onError) {
      onError(error);
    } else {
      console.error(
        "BitForm upload: state callback failed without error handler — provide onCallbackError to route to observability",
        error,
      );
    }
  }
}

export function createUploadHandler<
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  fieldPath: string,
  uploadFn: BitUploadFn<TMetadata>,
  callbacks: UploadKernelCallbacks,
  sharedGeneration?: { current: number },
): (file: File | null | undefined) => Promise<void> {
  const generation = sharedGeneration ?? { current: 0 };
  const onError = callbacks.onCallbackError;

  return async (file) => {
    if (!file) return;

    const myGeneration = ++generation.current;
    safeCallbackExecution(() => callbacks.setLoading(true), onError);
    safeCallbackExecution(() => callbacks.setError(fieldPath, undefined), onError);

    try {
      const result = await uploadFn(file);

      if (myGeneration !== generation.current) return;
      safeCallbackExecution(() => callbacks.setValue(result.url), onError);
      safeCallbackExecution(() => callbacks.setUploadKey(result.key), onError);
      safeCallbackExecution(() => callbacks.setError(fieldPath, undefined), onError);
    } catch (error) {
      if (myGeneration !== generation.current) return;
      const message = error instanceof Error ? error.message : "Upload failed";
      safeCallbackExecution(() => callbacks.setError(fieldPath, message), onError);
    } finally {
      if (myGeneration === generation.current) {
        safeCallbackExecution(() => callbacks.setLoading(false), onError);
      }
    }
  };
}

/**
 * Creates a type-safe `remove` handler for a field.
 */
export function createRemoveHandler(
  fieldPath: string,
  deleteFile: BitDeleteUploadFn | undefined,
  callbacks: UploadKernelCallbacks,
  sharedGeneration?: { current: number },
): () => Promise<void> {
  const onError = callbacks.onCallbackError;

  return async () => {
    if (sharedGeneration) {
      ++sharedGeneration.current;
    }
    const uploadKey = callbacks.getUploadKey();

    if (uploadKey && deleteFile) {
      try {
        await deleteFile(uploadKey);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Delete failed";
        // Use safeCallbackExecution to mirror createUploadHandler: if the adapter
        // throws inside setError (e.g. component already unmounted), the error is
        // routed to onCallbackError instead of escaping the promise unhandled.
        safeCallbackExecution(() => callbacks.setError(fieldPath, message), onError);
        return;
      }

      if (callbacks.getUploadKey() !== uploadKey) {
        return;
      }
    }

    safeCallbackExecution(() => callbacks.setValue(null), onError);
    safeCallbackExecution(() => callbacks.setUploadKey(null), onError);
    safeCallbackExecution(() => callbacks.setError(fieldPath, undefined), onError);
  };
}
