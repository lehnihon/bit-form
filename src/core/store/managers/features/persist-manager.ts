import { deepClone } from "../../../utils";
import type {
  BitPersistResolvedConfig,
  BitPersistStorageAdapter,
} from "../../contracts/types";

function getDefaultStorage(): BitPersistStorageAdapter | undefined {
  if (typeof globalThis === "undefined") return undefined;

  const storageLike = (globalThis as { localStorage?: Storage }).localStorage;
  if (!storageLike) return undefined;

  return {
    getItem: (key: string) => storageLike.getItem(key),
    setItem: (key: string, value: string) => storageLike.setItem(key, value),
    removeItem: (key: string) => storageLike.removeItem(key),
  };
}

export class BitPersistManager<T extends object = any> {
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private config: BitPersistResolvedConfig<T>,
    private getValues: () => T,
    private getDirtyValues: () => Partial<T>,
    private applyRestoredValues: (values: Partial<T>) => void,
  ) {}

  private getStorage(): BitPersistStorageAdapter | undefined {
    return this.config.storage || getDefaultStorage();
  }

  private canPersist() {
    return !!(this.config.enabled && this.config.key && this.getStorage());
  }

  private handleError(error: unknown) {
    this.config.onError?.(error);
  }

  async saveNow() {
    if (!this.canPersist()) return;

    const storage = this.getStorage();
    if (!storage) return;

    try {
      const payload =
        this.config.mode === "dirtyValues"
          ? this.getDirtyValues()
          : this.getValues();
      const serialized = this.config.serialize(deepClone(payload));
      await storage.setItem(this.config.key, serialized);
    } catch (error) {
      this.handleError(error);
    }
  }

  queueSave() {
    if (!this.canPersist() || !this.config.autoSave) return;

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      void this.saveNow();
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
      return false;
    }
  }

  async clear() {
    if (!this.canPersist()) return;

    const storage = this.getStorage();
    if (!storage) return;

    try {
      await storage.removeItem(this.config.key);
    } catch (error) {
      this.handleError(error);
    }
  }

  destroy() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}
