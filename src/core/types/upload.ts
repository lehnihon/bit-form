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

/** Upload function contract (backend-first). All context is managed by the caller. */
export type BitUploadFn = (file: File) => Promise<BitUploadResult>;

/** Optional delete function contract. */
export type BitDeleteUploadFn = (key: string) => Promise<void>;
