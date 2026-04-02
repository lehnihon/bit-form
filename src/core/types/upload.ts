/**
 * Upload Integration Types
 *
 * Core types for backend-first upload integration.
 */

/** Upload result with URL and key for reference/deletion. */
export interface BitUploadResult<
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  url: string;
  key: string;
  metadata?: TMetadata;
}

/** Upload function contract (backend-first). All context is managed by the caller. */
export type BitUploadFn<
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> = (file: File) => Promise<BitUploadResult<TMetadata>>;

/** Optional delete function contract. */
export type BitDeleteUploadFn = (key: string) => Promise<void>;

/** Canonical value used by upload bindings across frameworks. */
export type BitUploadValue = string | File | null;

/** Input accepted by upload handlers. */
export type BitUploadInput = File | null | undefined;

/**
 * Base upload contract for framework adapters.
 * Frameworks specialize `value`, `error`, and `isValidating` with their reactive wrappers.
 */
export interface BitUploadAdapterResult<TValue, TError, TIsValidating> {
  value: TValue;
  setValue: (value: BitUploadValue) => void;
  error: TError;
  isValidating: TIsValidating;
  upload: (file: BitUploadInput) => Promise<void>;
  remove: () => Promise<void>;
}
