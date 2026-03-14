import type {
  BitAfterSubmitEvent,
  BitAfterValidateEvent,
  BitBeforeSubmitEvent,
  BitBeforeValidateEvent,
  BitFieldChangeEvent,
  BitState,
} from "./types";
import { bitBus } from "./bus";
import { BitPersistManager } from "./persist-manager";
import { BitPluginManager } from "./plugin-manager";

export class BitStoreEffectEngine<T extends object> {
  constructor(
    private readonly storeId: string,
    private readonly storeInstance: unknown,
    private readonly persistManager: BitPersistManager<T>,
    private readonly pluginManager: BitPluginManager<T>,
  ) {}

  initialize(): void {
    this.pluginManager.setupAll();
    bitBus.stores[this.storeId] = this.storeInstance;
  }

  onStateUpdated(nextState: BitState<T>, valuesChanged: boolean): void {
    if (valuesChanged) {
      this.persistManager.queueSave();
    }

    bitBus.dispatch(this.storeId, nextState);
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

  beforeValidate(event: BitBeforeValidateEvent<T>): Promise<void> {
    return this.pluginManager.beforeValidate(event);
  }

  afterValidate(event: BitAfterValidateEvent<T>): Promise<void> {
    return this.pluginManager.afterValidate(event);
  }

  beforeSubmit(event: BitBeforeSubmitEvent<T>): Promise<void> {
    return this.pluginManager.beforeSubmit(event);
  }

  afterSubmit(event: BitAfterSubmitEvent<T>): Promise<void> {
    return this.pluginManager.afterSubmit(event);
  }

  onFieldChange(event: BitFieldChangeEvent<T>): void {
    this.pluginManager.onFieldChange(event);
  }

  reportOperationalError(event: {
    source: "submit";
    error: unknown;
    payload?: unknown;
  }): Promise<void> {
    return this.pluginManager.reportError(
      event.source,
      event.error,
      event.payload,
    );
  }

  destroy(): void {
    this.persistManager.destroy();
    this.pluginManager.destroy();
    delete bitBus.stores[this.storeId];
  }
}
