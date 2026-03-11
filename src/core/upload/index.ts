/**
 * Upload Integration Core
 *
 * Provides backend-first upload utilities.
 */

export * from "./types";

import { BitUploadFn, BitUploadResult, UseBitUploadOptions } from "./types";

/**
 * Legacy helper to create an asyncValidate function for upload completion.
 *
 * Prefer using `useBitUpload`/`injectBitUpload`, which already integrates
 * upload state with field validation lifecycle.
 *
 * Keep this only when implementing upload flow without framework upload hooks.
 *
 * @example
 * ```typescript
 * const validator = createUploadValidator({
 *   requiredMessage: "Avatar must be uploaded before submitting",
 * });
 *
 * store.registerField("avatar", {
 *   validation: {
 *     asyncValidate: validator,
 *     asyncValidateDelay: 200,
 *   },
 * });
 * ```
 */
export function createUploadValidator(options?: { requiredMessage?: string }) {
  return async (value: any): Promise<string | null> => {
    // If value is a URL (upload succeeded), validation passes
    if (typeof value === "string" && value.startsWith("http")) {
      return null;
    }

    // If value is a File object, upload hasn't completed yet
    if (value instanceof File) {
      return options?.requiredMessage || "File upload pending";
    }

    // If value is empty, upload is required
    if (!value) {
      return options?.requiredMessage || "File upload required";
    }

    return null;
  };
}

/**
 * Manages a single file upload.
 * Returns promise that resolves when upload completes or rejects on error.
 *
 * @example
 * ```typescript
 * try {
 *   const result = await performUpload(file, uploadFn, {
 *     uploadOptions: { folder: "avatars" },
 *   });
 *   store.setField("avatar", result.url);
 * } catch (err) {
 *   console.error("Upload failed:", err);
 * }
 * ```
 */
export async function performUpload(
  file: File,
  uploadFn: BitUploadFn,
  options?: UseBitUploadOptions,
): Promise<BitUploadResult> {
  return uploadFn(file, options?.uploadOptions);
}
