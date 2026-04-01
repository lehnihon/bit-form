import type { BitBusStorePort } from "../../contracts/bus-types";
import type {
  BitAfterSubmitEvent,
  BitAfterValidateEvent,
  BitBeforeSubmitEvent,
  BitBeforeValidateEvent,
  BitFieldChangeEvent,
  BitState,
} from "../../contracts/types";

export interface BitStoreEffect<T extends object> {
  name: string;
  attachStorePort?(storeBusPort: BitBusStorePort<T>): void;
  initialize?(): void;
  onStateUpdated?(nextState: BitState<T>, valuesChanged: boolean): void;
  restorePersisted?(): Promise<boolean>;
  savePersistedNow?(): Promise<void>;
  clearPersisted?(): Promise<void>;
  beforeValidate?(event: BitBeforeValidateEvent<T>): Promise<void>;
  afterValidate?(event: BitAfterValidateEvent<T>): Promise<void>;
  beforeSubmit?(event: BitBeforeSubmitEvent<T>): Promise<void>;
  afterSubmit?(event: BitAfterSubmitEvent<T>): Promise<void>;
  onFieldChange?(event: BitFieldChangeEvent<T>): void;
  reportOperationalError?(event: {
    source: "submit";
    error: unknown;
    payload?: unknown;
  }): Promise<void>;
  destroy?(): void;
}

export class BitEffectRegistry<T extends object> {
  private readonly effects = new Map<string, BitStoreEffect<T>>();

  register(effect: BitStoreEffect<T>): void {
    this.effects.set(effect.name, effect);
  }

  getAll(): BitStoreEffect<T>[] {
    return Array.from(this.effects.values());
  }
}
