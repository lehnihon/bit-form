/**
 * Upload Integration Core
 *
 * Provides utilities to integrate file uploads with asyncValidate.
 * Enables non-blocking upload orchestration within form submission.
 */

export * from "./types";

import { BitUploadFn, BitUploadResult, UseBitUploadOptions } from "./types";

/**
 * Creates an asyncValidate function that manages upload completion.
 *
 * Use this when you want asyncValidate to validate:
 * - File was successfully uploaded (url is set)
 * - Upload didn't fail with an error
 *
 * The actual upload happens in a separate handler (not in validation).
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
 * Manages a single file upload with progress tracking.
 * Returns promise that resolves when upload completes or rejects on error.
 *
 * @example
 * ```typescript
 * try {
 *   const result = await performUpload(
 *     file,
 *     s3Adapter,
 *     {
 *       folder: "avatars",
 *       onProgress: (p) => console.log(`${p.percentage}%`),
 *     }
 *   );
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
  try {
    return await uploadFn(file, {
      ...options?.uploadOptions,
      onProgress: options?.onProgress,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    options?.onError?.(err);
    throw err;
  }
}
