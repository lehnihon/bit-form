/**
 * Azure Blob Storage Upload Adapter
 *
 * Support for Microsoft Azure Blob Storage.
 *
 * @example
 * ```typescript
 * const adapter = createAzureBlobAdapter({
 *   storageAccount: "myaccount",
 *   accountKey: process.env.AZURE_STORAGE_KEY,
 *   container: "uploads",
 *   folder: "avatars",
 * });
 *
 * const result = await adapter.upload(file);
 * ```
 */

import {
  BitUploadAdapter,
  BitUploadResult,
  BitAzureBlobAdapterOptions,
} from "../../core/upload/types";

export function createAzureBlobAdapter(
  options: BitAzureBlobAdapterOptions,
): BitUploadAdapter {
  return {
    async upload(
      file: File,
      uploadOptions?: Record<string, any>,
    ): Promise<BitUploadResult> {
      const folder = uploadOptions?.folder || options.folder || "";
      const filename = `${Date.now()}-${file.name}`;
      const blobName = folder ? `${folder}/${filename}` : filename;

      // Use SAS token if available, otherwise use account key
      const urlBase = options.sasTokenUrl
        ? options.sasTokenUrl
        : buildStorageUrl(options.storageAccount, options.container);

      const uploadUrl = `${urlBase}/${blobName}`;

      try {
        const headers: HeadersInit = {
          "x-ms-blob-type": "BlockBlob",
          "Content-Type": file.type,
        };

        // Add signature if using account key
        if (options.accountKey && !options.sasTokenUrl) {
          // In production: create proper SAS signature
          // This is placeholder
          headers["Authorization"] =
            `SharedKey ${options.storageAccount}:<signature>`;
        }

        const response = await fetch(uploadUrl, {
          method: "PUT",
          headers,
          body: file,
        });

        if (!response.ok) {
          throw new Error(`Azure upload failed: ${response.statusText}`);
        }

        const publicUrl = `https://${options.storageAccount}.blob.core.windows.net/${options.container}/${blobName}`;

        return {
          url: publicUrl,
          key: blobName,
          metadata: { size: file.size, type: file.type },
        };
      } catch (error) {
        throw error instanceof Error
          ? error
          : new Error("Azure Blob upload failed");
      }
    },

    async delete(key: string): Promise<void> {
      console.log(`[Azure Blob Adapter] Would delete: ${key}`);
    },
  };
}

function buildStorageUrl(storageAccount: string, container: string): string {
  return `https://${storageAccount}.blob.core.windows.net/${container}`;
}
