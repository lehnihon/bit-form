/**
 * Upload Integration Types
 *
 * Core types for backend-first upload integration.
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

/** Context passed to upload function. */
export interface BitUploadContext {
  onProgress?: (progress: BitUploadProgress) => void;
  [key: string]: any;
}

/** Upload function contract (backend-first). */
export type BitUploadFn = (
  file: File,
  context?: BitUploadContext,
) => Promise<BitUploadResult>;

/** Optional delete function contract. */
export type BitDeleteUploadFn = (key: string) => Promise<void>;

/** Hook options for upload. */
export interface UseBitUploadOptions {
  uploadOptions?: Record<string, any>;
  deleteFile?: BitDeleteUploadFn;
}
