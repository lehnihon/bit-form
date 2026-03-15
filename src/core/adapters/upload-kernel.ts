/**
 * Framework-agnostic upload kernel.
 *
 * Encapsulates the side-effect logic for uploading/removing files so that
 * React, Vue, and Angular adapters share a single implementation and only
 * differ in how they wire reactive state.
 */

import type { BitUploadFn, BitDeleteUploadFn } from "../types/upload";

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
 * });
 * ```
 */
export function createUploadHandler(
  fieldPath: string,
  uploadFn: BitUploadFn,
  callbacks: UploadKernelCallbacks,
): (file: File | null | undefined) => Promise<void> {
  return async (file) => {
    if (!file) return;

    callbacks.setLoading(true);
    callbacks.setError(fieldPath, undefined);

    try {
      const result = await uploadFn(file);

      callbacks.setValue(result.url);
      callbacks.setUploadKey(result.key);
      callbacks.setError(fieldPath, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      callbacks.setError(fieldPath, message);
    } finally {
      callbacks.setLoading(false);
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
): () => Promise<void> {
  return async () => {
    const uploadKey = callbacks.getUploadKey();

    if (uploadKey && deleteFile) {
      try {
        await deleteFile(uploadKey);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Delete failed";
        callbacks.setError(fieldPath, message);
        return;
      }
    }

    callbacks.setValue(null);
    callbacks.setUploadKey(null);
    callbacks.setError(fieldPath, undefined);
  };
}
