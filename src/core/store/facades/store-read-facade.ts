import { BitMask, BitMaskName } from "../../mask/types";
import { getDeepValue } from "../../utils";
import type {
  BitFieldDefinition,
  BitFieldState,
  BitPath,
  BitPathValue,
  BitPersistMetadata,
  BitState,
  ScopeStatus,
} from "../contracts/types";
import type { BitFrameworkConfig } from "../contracts/public/store-api-types";
import type { BitHistoryMetadata } from "../contracts/public/meta-types";
import { BitDirtyManager } from "../managers/core/dirty-manager";
import { BitMaskManager } from "../managers/features/mask-manager";
import { BitFieldRegistry } from "../registry/field-registry";
import {
  createFieldStateSnapshot,
  resolveFieldMask,
} from "../engines/store-field-query-engine";
import { readHistoryFeatureMetadata } from "../orchestration/store-feature-ops";
import type { BitStoreRuntimeKernel } from "../orchestration/store-runtime-kernel";

export class BitStoreReadFacade<T extends object> {
  constructor(
    private readonly runtime: BitStoreRuntimeKernel<T>,
    private readonly fieldRegistry: BitFieldRegistry<T>,
    private readonly maskManager: BitMaskManager,
    private readonly dirtyManager: BitDirtyManager<T>,
    private readonly config: BitFrameworkConfig<T>,
  ) {}

  getConfig(): Readonly<BitFrameworkConfig<T>> {
    return this.config;
  }

  getFieldConfig(path: string): BitFieldDefinition<T> | undefined {
    return this.fieldRegistry.getFieldConfig(path);
  }

  getScopeFields(scopeName: string): string[] {
    return this.fieldRegistry.getScopeFields(scopeName);
  }

  resolveMask(path: string): BitMask | undefined {
    return resolveFieldMask<T>({
      path,
      getFieldConfig: (fieldPath) => this.getFieldConfig(fieldPath),
      masks: this.maskManager.getAllMasks() as Record<BitMaskName, BitMask>,
    });
  }

  createArrayItemId(path: string, index?: number): string {
    return this.config.idFactory({ scope: "array", path, index });
  }

  getState(): BitState<T> {
    return this.runtime.getState();
  }

  getFieldState<P extends BitPath<T>>(
    path: P,
  ): BitFieldState<T, BitPathValue<T, P>> {
    const effectiveState = this.getState();
    const value = getDeepValue(
      effectiveState.values,
      path as string,
    ) as BitPathValue<T, P>;

    return createFieldStateSnapshot({
      state: effectiveState,
      path,
      value,
      isHidden: this.isHidden(path),
      isRequired: this.isRequired(path),
      isDirty: this.isFieldDirty(path as string),
      isValidating: this.isFieldValidating(path as string),
    });
  }

  get isValid(): boolean {
    return this.getState().isValid;
  }

  get isSubmitting(): boolean {
    return this.getState().isSubmitting;
  }

  get isDirty(): boolean {
    return this.getState().isDirty;
  }

  isHidden<P extends BitPath<T>>(path: P): boolean {
    return this.runtime.capabilities.query.isHidden(path);
  }

  isRequired<P extends BitPath<T>>(path: P): boolean {
    return this.runtime.capabilities.query.isRequired(path);
  }

  isFieldDirty(path: string): boolean {
    return this.runtime.capabilities.query.isFieldDirty(path);
  }

  isFieldValidating(path: string): boolean {
    return this.runtime.capabilities.query.isFieldValidating(path);
  }

  getDirtyValues(): Partial<T> {
    return this.dirtyManager.buildDirtyValues(this.getState().values);
  }

  getPersistMetadata(): BitPersistMetadata {
    return this.getState().persist;
  }

  getHistoryMetadata(): BitHistoryMetadata {
    return readHistoryFeatureMetadata({
      history: this.runtime.capabilities.history,
    });
  }

  getScopeStatus(scopeName: string): ScopeStatus {
    return this.runtime.capabilities.scope.getScopeStatus(scopeName);
  }

  getScopeErrors(scopeName: string): Record<string, string> {
    return this.runtime.capabilities.scope.getScopeErrors(scopeName);
  }
}
