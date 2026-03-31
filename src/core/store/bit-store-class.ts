import type {
  BitFrameworkConfig,
  BitStoreFeatureApi,
  BitStoreObserveSliceApi,
  BitStoreReadSliceApi,
  BitStoreWriteSliceApi,
} from "./contracts/public/store-api-types";
import type { BitConfig } from "./contracts/types";
import { resolveFieldMask } from "./engines/store-field-query-engine";
import { BIT_FRAMEWORK_STORE_SYMBOL } from "./orchestration/framework-store-brand";
import { BIT_HOOKS_API_SYMBOL } from "./orchestration/hook-brand";
import { composeBitStoreRuntime } from "./orchestration/store-composition-root";
import { createBitStoreDomains } from "./orchestration/store-domains";
import { buildStoreSlicesApi } from "./orchestration/store-slices-factory";
import { BitStoreStateReader } from "./shared/store-state-reader";

export class BitStore<T extends object = Record<string, unknown>> {
  public readonly [BIT_HOOKS_API_SYMBOL] = true;
  public readonly [BIT_FRAMEWORK_STORE_SYMBOL] = true;

  public readonly storeId: string;

  private readonly _config: BitFrameworkConfig<T>;

  public readonly read: BitStoreReadSliceApi<T>;
  public readonly observe: BitStoreObserveSliceApi<T>;
  public readonly write: BitStoreWriteSliceApi<T>;
  public readonly feature: BitStoreFeatureApi<T>;

  constructor(config: BitConfig<T> = {}) {
    const composition = composeBitStoreRuntime<T>({
      rawConfig: config,
    });

    this._config = composition.config;
    this.storeId = composition.storeId;

    const stateReader = new BitStoreStateReader<T>({
      getState: () => composition.runtime.getState(),
      isHidden: (path) => composition.runtime.capabilities.query.isHidden(path),
      isRequired: (path) =>
        composition.runtime.capabilities.query.isRequired(path),
      isFieldDirty: (path) =>
        composition.runtime.capabilities.query.isFieldDirty(path),
      isFieldValidating: (path) =>
        composition.runtime.capabilities.query.isFieldValidating(path),
    });

    const domains = createBitStoreDomains<T>({
      runtime: composition.runtime,
      config: this._config,
      fieldRegistry: composition.fieldRegistry,
      dirtyManager: composition.dirtyManager,
      stateReader,
    });

    const slices = buildStoreSlicesApi<T>({
      identity: {
        storeId: this.storeId,
        config: this._config,
      },
      read: domains.read,
      observe: domains.observe,
      write: domains.write,
      feature: domains.feature,
      getFieldConfig: (path) => composition.fieldRegistry.getFieldConfig(path),
      resolveMask: (path) =>
        resolveFieldMask<T>({
          path,
          getFieldConfig: (fieldPath) =>
            composition.fieldRegistry.getFieldConfig(fieldPath),
          masks: composition.maskManager.getAllMasks(),
        }),
      createArrayItemId: (path, index) =>
        this._config.idFactory({ scope: "array", path, index }),
    });

    this.read = slices.read;
    this.observe = slices.observe;
    this.write = slices.write;
    this.feature = slices.feature;

    composition.runtime.effects.attachStorePort({
      getState: () => this.read.getState(),
      getHistoryMetadata: () => this.read.getHistoryMetadata(),
      undo: () => this.feature.undo(),
      redo: () => this.feature.redo(),
      reset: () => this.write.reset(),
    });
  }
}
