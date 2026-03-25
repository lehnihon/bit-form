import type { BitFieldDefinition } from "../contracts/types";
import type { BitFrameworkConfig } from "../contracts/public/store-api-types";
import { BitFieldRegistry } from "../registry/field-registry";
import {
  registerStoreField,
  unregisterStoreField,
  unregisterStorePrefix,
} from "../orchestration/store-registration-ops";
import type { BitStoreRuntimeKernel } from "../orchestration/store-runtime-kernel";

export class BitStoreRegisterFacade<T extends object> {
  constructor(
    private readonly runtime: BitStoreRuntimeKernel<T>,
    private readonly fieldRegistry: BitFieldRegistry<T>,
    private readonly config: BitFrameworkConfig<T>,
  ) {}

  registerField(path: string, config: BitFieldDefinition<T>): void {
    registerStoreField({
      path,
      config,
      state: this.runtime.getState(),
      fieldRegistry: this.fieldRegistry,
      subscriptions: this.runtime.subscriptions,
      invalidateFieldIndexes: () => {
        this.fieldRegistry.invalidateIndexes();
      },
    });
  }

  unregisterField(path: string): void {
    unregisterStoreField({
      path,
      state: this.runtime.getState(),
      hasStaticConfig: !!this.config.fields?.[path as string],
      fieldRegistry: this.fieldRegistry,
      subscriptions: this.runtime.subscriptions,
      validationCleanupField: (fieldPath) =>
        this.runtime.capabilities.validation.cleanupField(fieldPath),
      invalidateFieldIndexes: () => {
        this.fieldRegistry.invalidateIndexes();
      },
      dispatch: (operation) => this.runtime.dispatch(operation),
    });
  }

  unregisterPrefix(prefix: string): void {
    unregisterStorePrefix({
      prefix,
      state: this.runtime.getState(),
      fieldRegistry: this.fieldRegistry,
      subscriptions: this.runtime.subscriptions,
      validationCleanupPrefix: (fieldPrefix) =>
        this.runtime.capabilities.validation.cleanupPrefix(fieldPrefix),
      invalidateFieldIndexes: () => {
        this.fieldRegistry.invalidateIndexes();
      },
    });
  }
}
