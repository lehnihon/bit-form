export type BitMaybePromise<T> = T | Promise<T>;

export interface BitPersistStorageAdapter {
  getItem(key: string): BitMaybePromise<string | null>;
  setItem(key: string, value: string): BitMaybePromise<void>;
  removeItem(key: string): BitMaybePromise<void>;
}

export type BitPersistMode = "values" | "dirtyValues";

export interface BitPersistConfig<T extends object = Record<string, unknown>> {
  enabled?: boolean;
  key?: string;
  storage?: BitPersistStorageAdapter;
  autoSave?: boolean;
  debounceMs?: number;
  mode?: BitPersistMode;
  serialize?: (payload: unknown) => string;
  deserialize?: (raw: string) => Partial<T>;
  onError?: (error: unknown) => void;
}

export interface BitPersistResolvedConfig<
  T extends object = Record<string, unknown>,
> {
  enabled: boolean;
  key: string;
  storage?: BitPersistStorageAdapter;
  autoSave: boolean;
  debounceMs: number;
  mode: BitPersistMode;
  serialize: (payload: unknown) => string;
  deserialize: (raw: string) => Partial<T>;
  onError?: (error: unknown) => void;
}
