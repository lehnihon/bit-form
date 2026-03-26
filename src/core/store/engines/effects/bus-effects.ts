import type { BitState } from "../../contracts/types";
import type { BitFormGlobal } from "../../contracts/bus-types";

export class BitBusEffects<T extends object> {
  constructor(
    private readonly storeId: string,
    private readonly storeInstance: unknown,
    private readonly bus: BitFormGlobal,
    private readonly enableBusDispatch = true,
  ) {}

  initialize(): void {
    if (!this.enableBusDispatch) {
      return;
    }

    this.bus.stores[this.storeId] = this.storeInstance;
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
