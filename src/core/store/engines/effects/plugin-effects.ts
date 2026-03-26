import type {
  BitAfterSubmitEvent,
  BitAfterValidateEvent,
  BitBeforeSubmitEvent,
  BitBeforeValidateEvent,
  BitFieldChangeEvent,
} from "../../contracts/types";
import { BitPluginManager } from "../../managers/features/plugin-manager";

export class BitPluginEffects<T extends object> {
  constructor(private readonly pluginManager: BitPluginManager<T>) {}

  initialize(): void {
    this.pluginManager.setupAll();
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
    this.pluginManager.destroy();
  }
}
