/**
 * AWS S3 Upload Adapter
 *
 * Supports direct browser uploads to S3 using presigned URLs or credentials.
 *
 * @example
 * ```typescript
 * const adapter = createS3Adapter({
 *   region: "us-east-1",
 *   bucket: "my-bucket",
 *   credentials: {
 *     accessKeyId: process.env.REACT_APP_AWS_KEY,
 *     secretAccessKey: process.env.REACT_APP_AWS_SECRET,
 *   },
 *   publicUrlBase: "https://cdn.example.com",
 * });
 *
 * const result = await adapter.upload(file, { folder: "avatars" });
 * console.log(result.url); // https://cdn.example.com/avatars/filename.jpg
 * ```
 */

import {
  BitUploadAdapter,
  BitUploadResult,
  BitS3AdapterOptions,
} from "../../core/upload/types";

export function createS3Adapter(
  options: BitS3AdapterOptions,
): BitUploadAdapter {
  return {
    async upload(
      file: File,
      uploadOptions?: Record<string, any>,
    ): Promise<BitUploadResult> {
      const folder = uploadOptions?.folder || options.folder || "";
      const filename = `${Date.now()}-${file.name}`;
      const key = folder ? `${folder}/${filename}` : filename;

      // For production, use proper S3 client
      // This is a simplified mock/placeholder implementation
      if (options.presignedUrlEndpoint) {
        return uploadViaPresignedUrl(file, key, options.presignedUrlEndpoint);
      } else if (options.credentials) {
        // In real scenario: use @aws-sdk/client-s3
        throw new Error(
          "Direct credential upload requires AWS SDK. Use presigned URLs instead for browser.",
        );
      } else {
        throw new Error(
          "Either presignedUrlEndpoint or credentials must be provided",
        );
      }
    },

    async delete(key: string): Promise<void> {
      // Implement S3 delete via Lambda or API
      console.log(`[S3 Adapter] Would delete: ${key}`);
    },
  };
}

async function uploadViaPresignedUrl(
  file: File,
  key: string,
  presignedUrlEndpoint: string,
): Promise<BitUploadResult> {
  // Step 1: Get presigned URL from backend
  const urlResponse = await fetch(presignedUrlEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, contentType: file.type }),
  });

  if (!urlResponse.ok) {
    throw new Error(`Failed to get presigned URL: ${urlResponse.statusText}`);
  }

  const { presignedUrl, publicUrl } = await urlResponse.json();

  // Step 2: Upload file to S3 using presigned URL
  const uploadResponse = await fetch(presignedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error(`S3 upload failed: ${uploadResponse.statusText}`);
  }

  return {
    url: publicUrl || presignedUrl.split("?")[0],
    key,
    metadata: { size: file.size, type: file.type },
  };
}
