import type { BitBusStorePort } from "../contracts/bus-types";
import type {
  BitAfterSubmitEvent,
  BitAfterValidateEvent,
  BitBeforeSubmitEvent,
  BitBeforeValidateEvent,
  BitFieldChangeEvent,
  BitState,
} from "../contracts/types";
import {
  BitEffectRegistry,
  type BitStoreEffect,
} from "./effects/effect-registry";

export class BitStoreEffectEngine<T extends object> {
  private readonly effects: BitStoreEffect<T>[];

  constructor(registry: BitEffectRegistry<T>) {
    this.effects = registry.getAll();
  }

  attachStorePort(storeBusPort: BitBusStorePort<T>): void {
    this.effects.forEach((effect) => effect.attachStorePort?.(storeBusPort));
  }

  initialize(): void {
    this.effects.forEach((effect) => effect.initialize?.());
  }

  onStateUpdated(nextState: BitState<T>, valuesChanged: boolean): void {
    this.effects.forEach((effect) =>
      effect.onStateUpdated?.(nextState, valuesChanged),
    );
  }

  async restorePersisted(): Promise<boolean> {
    let restored = false;

    for (const effect of this.effects) {
      if (!effect.restorePersisted) {
        continue;
      }

      restored = (await effect.restorePersisted()) || restored;
    }

    return restored;
  }

  async savePersistedNow(): Promise<void> {
    for (const effect of this.effects) {
      if (!effect.savePersistedNow) {
        continue;
      }

      await effect.savePersistedNow();
    }
  }

  async clearPersisted(): Promise<void> {
    for (const effect of this.effects) {
      if (!effect.clearPersisted) {
        continue;
      }

      await effect.clearPersisted();
    }
  }

  async beforeValidate(event: BitBeforeValidateEvent<T>): Promise<void> {
    for (const effect of this.effects) {
      if (!effect.beforeValidate) {
        continue;
      }

      try {
        await effect.beforeValidate(event);
      } catch (error) {
        this.logEffectHookError(effect.name, "beforeValidate", error);
      }
    }
  }

  async afterValidate(event: BitAfterValidateEvent<T>): Promise<void> {
    for (const effect of this.effects) {
      if (!effect.afterValidate) {
        continue;
      }

      try {
        await effect.afterValidate(event);
      } catch (error) {
        this.logEffectHookError(effect.name, "afterValidate", error);
      }
    }
  }

  async beforeSubmit(event: BitBeforeSubmitEvent<T>): Promise<void> {
    for (const effect of this.effects) {
      if (!effect.beforeSubmit) {
        continue;
      }

      try {
        await effect.beforeSubmit(event);
      } catch (error) {
        this.logEffectHookError(effect.name, "beforeSubmit", error);
      }
    }
  }

  async afterSubmit(event: BitAfterSubmitEvent<T>): Promise<void> {
    for (const effect of this.effects) {
      if (!effect.afterSubmit) {
        continue;
      }

      try {
        await effect.afterSubmit(event);
      } catch (error) {
        this.logEffectHookError(effect.name, "afterSubmit", error);
      }
    }
  }

  onFieldChange(event: BitFieldChangeEvent<T>): void {
    this.effects.forEach((effect) => {
      try {
        effect.onFieldChange?.(event);
      } catch (error) {
        this.logEffectHookError(effect.name, "onFieldChange", error);
      }
    });
  }

  async reportOperationalError(event: {
    source: "submit";
    error: unknown;
    payload?: unknown;
  }): Promise<void> {
    for (const effect of this.effects) {
      if (!effect.reportOperationalError) {
        continue;
      }

      try {
        await effect.reportOperationalError(event);
      } catch (error) {
        this.logEffectHookError(effect.name, "reportOperationalError", error);
      }
    }
  }

  private logEffectHookError(
    effectName: string,
    hookName:
      | "beforeValidate"
      | "afterValidate"
      | "beforeSubmit"
      | "afterSubmit"
      | "onFieldChange"
      | "reportOperationalError",
    error: unknown,
  ): void {
    console.error(
      `BitStoreEffectEngine: effect "${effectName}" failed in hook "${hookName}"`,
      error,
    );
  }

  destroy(): void {
    // Tear down in reverse registration order to preserve dependency ordering.
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      this.effects[index].destroy?.();
    }
  }
}
