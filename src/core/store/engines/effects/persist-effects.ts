import type { BitState } from "../../contracts/types";
import { BitPersistManager } from "../../managers/features/persist-manager";

export class BitPersistEffects<T extends object> {
  private beforeUnloadHandler: (() => void) | null = null;

  constructor(private readonly persistManager: BitPersistManager<T>) {}

  initialize(): void {
    if (typeof window !== "undefined") {
      this.beforeUnloadHandler = () => {
        this.persistManager.saveNow();
      };
      window.addEventListener("beforeunload", this.beforeUnloadHandler);
    }
  }

  onStateUpdated(_nextState: BitState<T>, valuesChanged: boolean): void {
    if (valuesChanged) {
      this.persistManager.queueSave();
    }
  }

  restorePersisted(): Promise<boolean> {
    return this.persistManager.restore();
  }

  savePersistedNow(): Promise<void> {
    return this.persistManager.saveNow();
  }

  clearPersisted(): Promise<void> {
    return this.persistManager.clear();
  }

  destroy(): void {
    if (this.beforeUnloadHandler) {
      window.removeEventListener("beforeunload", this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
    this.persistManager.destroy();
  }
}
