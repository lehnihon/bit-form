import type { BitState } from "../../contracts/types";
import { BitPersistManager } from "../../managers/features/persist-manager";

export class BitPersistEffects<T extends object> {
  constructor(private readonly persistManager: BitPersistManager<T>) {}

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
    this.persistManager.destroy();
  }
}
