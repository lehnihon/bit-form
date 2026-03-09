/**
 * Upload Integration Types
 *
 * Core types for file upload integration with asyncValidate.
 * Supports S3, Cloudinary, Azure, and custom adapters.
 */

/** Upload result with URL and key for reference/deletion. */
export interface BitUploadResult {
  url: string;
  key: string;
  metadata?: Record<string, any>;
}

/** Progress tracking during upload. */
export interface BitUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/** Generic upload adapter interface. */
export interface BitUploadAdapter {
  /**
   * Upload file to storage.
   * @param file - File to upload
   * @param options - Upload options (metadata, folder, etc)
   * @returns Upload result with URL and key
   */
  upload(file: File, options?: Record<string, any>): Promise<BitUploadResult>;

  /**
   * Delete file from storage.
   * @param key - File key/ID from upload result
   * @returns Promise that resolves when deleted
   */
  delete?(key: string): Promise<void>;
}

/** Hook options for upload. */
export interface UseBitUploadOptions {
  /** Called when upload progress changes. */
  onProgress?: (progress: BitUploadProgress) => void;
  /** Called when upload fails. */
  onError?: (error: Error) => void;
  /** Called when upload succeeds. */
  onSuccess?: (result: BitUploadResult) => void;
  /** Custom upload options (varies by adapter). */
  uploadOptions?: Record<string, any>;
}

/** S3 adapter configuration. */
export interface BitS3AdapterOptions {
  region: string;
  bucket: string;
  /** ARN or credentials for upload. */
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  /** Pre-signed URL endpoint (if not using credentials). */
  presignedUrlEndpoint?: string;
  /** Folder/prefix in bucket. */
  folder?: string;
  /** Public URL base (e.g., CDN). */
  publicUrlBase?: string;
}

/** Cloudinary adapter configuration. */
export interface BitCloudinaryAdapterOptions {
  cloudName: string;
  uploadPreset: string;
  /** API key (if not using unsigned preset). */
  apiKey?: string;
  /** Folder in Cloudinary. */
  folder?: string;
  /** Resource type: auto, image, video, raw. */
  resourceType?: "auto" | "image" | "video" | "raw";
}

/** Azure Blob Storage adapter configuration. */
export interface BitAzureBlobAdapterOptions {
  storageAccount: string;
  /** Account key or connection string. */
  accountKey: string;
  container: string;
  /** Folder/path in container. */
  folder?: string;
  /** SAS token URL (alternative to accountKey). */
  sasTokenUrl?: string;
}

/** Generic upload adapter factory return type. */
export interface BitUploadAdapterFactory {
  adapter: BitUploadAdapter;
  options?: Record<string, any>;
}
