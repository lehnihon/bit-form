import type { BitBusStorePort, BitFormGlobal } from "../../contracts/bus-types";
import type { BitState } from "../../contracts/types";

export class BitBusEffects<T extends object> {
  private storeBusPort?: BitBusStorePort<T>;

  constructor(
    private readonly storeId: string,
    private readonly bus: BitFormGlobal,
    private readonly enableBusDispatch = true,
    storeBusPort?: BitBusStorePort<T>,
  ) {
    this.storeBusPort = storeBusPort;
  }

  attachStorePort(storeBusPort: BitBusStorePort<T>): void {
    this.storeBusPort = storeBusPort;

    if (!this.enableBusDispatch) {
      return;
    }

    this.bus.stores[this.storeId] = storeBusPort as BitBusStorePort<object>;
  }

  initialize(): void {
    if (!this.enableBusDispatch || !this.storeBusPort) {
      return;
    }

    this.bus.stores[this.storeId] = this
      .storeBusPort as BitBusStorePort<object>;
  }

  onStateUpdated(nextState: BitState<T>): void {
    if (!this.enableBusDispatch) {
      return;
    }

    this.bus.dispatch(this.storeId, nextState);
  }

  destroy(): void {
    if (!this.enableBusDispatch) {
      return;
    }

    delete this.bus.stores[this.storeId];
  }
}
