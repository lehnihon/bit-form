/**
 * Cloudinary Upload Adapter
 *
 * Browser-friendly upload using Cloudinary without backend.
 *
 * @example
 * ```typescript
 * const adapter = createCloudinaryAdapter({
 *   cloudName: "my-cloud",
 *   uploadPreset: "my-preset",
 *   folder: "my-app/avatars",
 * });
 *
 * const result = await adapter.upload(file);
 * console.log(result.url); // https://res.cloudinary.com/my-cloud/image/upload/my-app/avatars/xxx.jpg
 * ```
 */

import {
  BitUploadAdapter,
  BitUploadResult,
  BitCloudinaryAdapterOptions,
} from "../../core/upload/types";

export function createCloudinaryAdapter(
  options: BitCloudinaryAdapterOptions,
): BitUploadAdapter {
  return {
    async upload(
      file: File,
      uploadOptions?: Record<string, any>,
    ): Promise<BitUploadResult> {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", options.uploadPreset);

      if (options.folder) {
        formData.append("folder", uploadOptions?.folder || options.folder);
      }

      if (options.apiKey) {
        formData.append("api_key", options.apiKey);
      }

      formData.append("resource_type", options.resourceType || "auto");

      try {
        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${options.cloudName}/auto/upload`,
          {
            method: "POST",
            body: formData,
          },
        );

        if (!response.ok) {
          throw new Error(`Cloudinary upload failed: ${response.statusText}`);
        }

        const data = await response.json();

        return {
          url: data.secure_url || data.url,
          key: data.public_id,
          metadata: {
            type: data.resource_type,
            size: data.bytes,
            width: data.width,
            height: data.height,
          },
        };
      } catch (error) {
        throw error instanceof Error
          ? error
          : new Error("Cloudinary upload failed");
      }
    },

    async delete(key: string): Promise<void> {
      // Requires Cloudinary Admin API (backend only)
      console.log(`[Cloudinary Adapter] Would delete: ${key}`);
      console.log(
        "Note: Deletion requires Admin API and cannot be done from browser.",
      );
    },
  };
}
