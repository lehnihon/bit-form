import type { BitBusStorePort, BitFormGlobal } from "../contracts/bus-types";
import type {
  BitAfterSubmitEvent,
  BitAfterValidateEvent,
  BitBeforeSubmitEvent,
  BitBeforeValidateEvent,
  BitFieldChangeEvent,
  BitState,
} from "../contracts/types";
import { BitPersistManager } from "../managers/features/persist-manager";
import { BitPluginManager } from "../managers/features/plugin-manager";
import { BitBusEffects } from "./effects/bus-effects";
import { BitPersistEffects } from "./effects/persist-effects";
import { BitPluginEffects } from "./effects/plugin-effects";

export class BitStoreEffectEngine<T extends object> {
  private readonly persistEffects: BitPersistEffects<T>;
  private readonly pluginEffects: BitPluginEffects<T>;
  private readonly busEffects: BitBusEffects<T>;

  constructor(
    storeId: string,
    bus: BitFormGlobal,
    persistManager: BitPersistManager<T>,
    pluginManager: BitPluginManager<T>,
    enableBusDispatch = true,
    storeBusPort?: BitBusStorePort<T>,
  ) {
    this.persistEffects = new BitPersistEffects<T>(persistManager);
    this.pluginEffects = new BitPluginEffects<T>(pluginManager);
    this.busEffects = new BitBusEffects<T>(
      storeId,
      bus,
      enableBusDispatch,
      storeBusPort,
    );
  }

  attachStorePort(storeBusPort: BitBusStorePort<T>): void {
    this.busEffects.attachStorePort(storeBusPort);
  }

  initialize(): void {
    this.pluginEffects.initialize();
    this.busEffects.initialize();
  }

  onStateUpdated(nextState: BitState<T>, valuesChanged: boolean): void {
    this.persistEffects.onStateUpdated(nextState, valuesChanged);
    this.busEffects.onStateUpdated(nextState);
  }

  restorePersisted(): Promise<boolean> {
    return this.persistEffects.restorePersisted();
  }

  savePersistedNow(): Promise<void> {
    return this.persistEffects.savePersistedNow();
  }

  clearPersisted(): Promise<void> {
    return this.persistEffects.clearPersisted();
  }

  beforeValidate(event: BitBeforeValidateEvent<T>): Promise<void> {
    return this.pluginEffects.beforeValidate(event);
  }

  afterValidate(event: BitAfterValidateEvent<T>): Promise<void> {
    return this.pluginEffects.afterValidate(event);
  }

  beforeSubmit(event: BitBeforeSubmitEvent<T>): Promise<void> {
    return this.pluginEffects.beforeSubmit(event);
  }

  afterSubmit(event: BitAfterSubmitEvent<T>): Promise<void> {
    return this.pluginEffects.afterSubmit(event);
  }

  onFieldChange(event: BitFieldChangeEvent<T>): void {
    this.pluginEffects.onFieldChange(event);
  }

  reportOperationalError(event: {
    source: "submit";
    error: unknown;
    payload?: unknown;
  }): Promise<void> {
    return this.pluginEffects.reportOperationalError(event);
  }

  destroy(): void {
    this.persistEffects.destroy();
    this.pluginEffects.destroy();
    this.busEffects.destroy();
  }
}
