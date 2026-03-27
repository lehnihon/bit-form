import type { BitState } from "../../contracts/types";
import type { BitBusStorePort, BitFormGlobal } from "../../contracts/bus-types";

export class BitBusEffects<T extends object> {
  constructor(
    private readonly storeId: string,
    private readonly storeBusPort: BitBusStorePort<T>,
    private readonly bus: BitFormGlobal,
    private readonly enableBusDispatch = true,
  ) {}

  initialize(): void {
    if (!this.enableBusDispatch) {
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
