import type {
  BitPersistResolvedConfig,
  BitPersistStorageAdapter,
} from "../../contracts/types";

interface BitPersistManagerCallbacks {
  onWriteStart?: () => void;
  onWriteSuccess?: () => void;
  onWriteError?: (error: unknown) => void;
  onWriteSettled?: () => void;
  onError?: (error: unknown) => void;
}

function getDefaultStorage(): BitPersistStorageAdapter | undefined {
  if (typeof globalThis === "undefined") return undefined;

  let storageLike: Storage | undefined;
  try {
    storageLike =
      (globalThis as { localStorage?: Storage }).localStorage ?? undefined;
  } catch {
    // Safari Private Mode and some restricted WebViews throw a SecurityError
    // when the localStorage getter is accessed. Treat as unavailable.
    return undefined;
  }

  if (!storageLike) return undefined;

  return {
    getItem: (key: string) => storageLike!.getItem(key),
    setItem: (key: string, value: string) => storageLike!.setItem(key, value),
    removeItem: (key: string) => storageLike!.removeItem(key),
  };
}

export class BitPersistManager<T extends object = Record<string, unknown>> {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private writeQueue: Promise<void> = Promise.resolve();
  private activeWrites = 0;

  constructor(
    private config: BitPersistResolvedConfig<T>,
    private getValues: () => T,
    private getDirtyValues: () => Partial<T>,
    private applyRestoredValues: (values: Partial<T>) => void,
    private callbacks: BitPersistManagerCallbacks = {},
  ) {}

  private getStorage(): BitPersistStorageAdapter | undefined {
    return this.config.storage || getDefaultStorage();
  }

  private canPersist() {
    return !!(this.config.enabled && this.config.key && this.getStorage());
  }

  private handleError(error: unknown) {
    this.callbacks.onError?.(error);
    this.config.onError?.(error);
  }

  private enqueueWriteOperation(operation: () => Promise<void>): Promise<void> {
    this.activeWrites += 1;

    if (this.activeWrites === 1) {
      this.callbacks.onWriteStart?.();
    }

    const run = this.writeQueue.then(operation, operation);
    this.writeQueue = run.then(
      () => undefined,
      () => undefined,
    );

    const observed = run.then(
      () => ({ ok: true as const, error: undefined }),
      (error) => ({ ok: false as const, error }),
    );

    return observed.then((result) => {
      this.activeWrites = Math.max(0, this.activeWrites - 1);

      if (result.ok) {
        if (this.activeWrites === 0) {
          this.callbacks.onWriteSuccess?.();
          this.callbacks.onWriteSettled?.();
        }
        return;
      }

      this.callbacks.onWriteError?.(result.error);

      if (this.activeWrites === 0) {
        this.callbacks.onWriteSettled?.();
      }

      throw result.error;
    });
  }

  private async persistPayload() {
    const storage = this.getStorage();
    if (!storage) return;

    const payload =
      this.config.mode === "dirtyValues"
        ? this.getDirtyValues()
        : this.getValues();
    const serialized = this.config.serialize(payload);
    await storage.setItem(this.config.key, serialized);
  }

  async saveNow() {
    if (!this.canPersist()) return;

    await this.enqueueWriteOperation(async () => {
      try {
        await this.persistPayload();
      } catch (error) {
        this.handleError(error);
        throw error;
      }
    });
  }

  queueSave() {
    if (!this.canPersist() || !this.config.autoSave) return;

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.saveNow().catch(() => {
        // saveNow already routes persist errors via callbacks and config handlers.
      });
    }, this.config.debounceMs);
  }

  async restore() {
    if (!this.canPersist()) return false;

    const storage = this.getStorage();
    if (!storage) return false;

    try {
      const raw = await storage.getItem(this.config.key);
      if (!raw) return false;

      const parsed = this.config.deserialize(raw);
      if (!parsed || typeof parsed !== "object") {
        return false;
      }

      this.applyRestoredValues(parsed);
      return true;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async clear() {
    if (!this.canPersist()) return;

    const storage = this.getStorage();
    if (!storage) return;

    await this.enqueueWriteOperation(async () => {
      try {
        await storage.removeItem(this.config.key);
      } catch (error) {
        this.handleError(error);
        throw error;
      }
    });
  }

  destroy() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}
