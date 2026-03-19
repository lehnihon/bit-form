import type { BitFieldDefinition, BitTransformFn } from "../contracts/types";
import type { BitComputedEntry } from "../managers/core/computed-manager";

export interface BitStoreFieldIndexState<T extends object> {
  scopeFieldsIndex: Map<string, string[]> | null;
  computedEntriesCache: BitComputedEntry<T>[] | null;
  transformEntriesCache: [string, BitTransformFn<T>][] | null;
}

export function createStoreFieldIndexState<
  T extends object,
>(): BitStoreFieldIndexState<T> {
  return {
    scopeFieldsIndex: null,
    computedEntriesCache: null,
    transformEntriesCache: null,
  };
}

export function invalidateStoreFieldIndexes<T extends object>(
  fieldIndexState: BitStoreFieldIndexState<T>,
): void {
  fieldIndexState.scopeFieldsIndex = null;
  fieldIndexState.computedEntriesCache = null;
  fieldIndexState.transformEntriesCache = null;
}

export function registerCachedFieldIndexes<T extends object>(args: {
  fieldIndexState: BitStoreFieldIndexState<T>;
  path: string;
  config: BitFieldDefinition<T>;
}): void {
  const { fieldIndexState, path, config } = args;

  if (fieldIndexState.scopeFieldsIndex && config.scope) {
    const scopedPaths =
      fieldIndexState.scopeFieldsIndex.get(config.scope) ?? [];
    if (!scopedPaths.includes(path)) {
      scopedPaths.push(path);
      fieldIndexState.scopeFieldsIndex.set(config.scope, scopedPaths);
    }
  }

  if (fieldIndexState.computedEntriesCache && config.computed) {
    fieldIndexState.computedEntriesCache.push({
      path,
      compute: config.computed,
      dependsOn: config.computedDependsOn ?? config.conditional?.dependsOn,
    });
  }

  if (fieldIndexState.transformEntriesCache && config.transform) {
    fieldIndexState.transformEntriesCache.push([path, config.transform]);
  }
}

export function unregisterCachedFieldIndexes<T extends object>(args: {
  fieldIndexState: BitStoreFieldIndexState<T>;
  path: string;
  config?: BitFieldDefinition<T>;
}): void {
  const { fieldIndexState, path, config } = args;

  if (!config) {
    invalidateStoreFieldIndexes(fieldIndexState);
    return;
  }

  if (fieldIndexState.scopeFieldsIndex && config.scope) {
    const scopedPaths = fieldIndexState.scopeFieldsIndex.get(config.scope);
    if (scopedPaths) {
      const nextPaths = scopedPaths.filter((fieldPath) => fieldPath !== path);
      if (nextPaths.length > 0) {
        fieldIndexState.scopeFieldsIndex.set(config.scope, nextPaths);
      } else {
        fieldIndexState.scopeFieldsIndex.delete(config.scope);
      }
    }
  }

  if (fieldIndexState.computedEntriesCache && config.computed) {
    fieldIndexState.computedEntriesCache =
      fieldIndexState.computedEntriesCache.filter(
        (entry) => entry.path !== path,
      );
  }

  if (fieldIndexState.transformEntriesCache && config.transform) {
    fieldIndexState.transformEntriesCache =
      fieldIndexState.transformEntriesCache.filter(
        ([entryPath]) => entryPath !== path,
      );
  }
}

export function getScopeFields<T extends object>(args: {
  fieldIndexState: BitStoreFieldIndexState<T>;
  scopeName: string;
  forEachFieldConfig: (
    iteratee: (cfg: BitFieldDefinition<T>, path: string) => void,
  ) => void;
}): string[] {
  const { fieldIndexState, scopeName, forEachFieldConfig } = args;

  if (!fieldIndexState.scopeFieldsIndex) {
    const index = new Map<string, string[]>();
    forEachFieldConfig((cfg, path) => {
      if (!cfg.scope) {
        return;
      }
      const list = index.get(cfg.scope) ?? [];
      list.push(path);
      index.set(cfg.scope, list);
    });
    fieldIndexState.scopeFieldsIndex = index;
  }

  return fieldIndexState.scopeFieldsIndex.get(scopeName) ?? [];
}

export function getComputedEntries<T extends object>(args: {
  fieldIndexState: BitStoreFieldIndexState<T>;
  forEachFieldConfig: (
    iteratee: (cfg: BitFieldDefinition<T>, path: string) => void,
  ) => void;
}): BitComputedEntry<T>[] {
  const { fieldIndexState, forEachFieldConfig } = args;

  if (!fieldIndexState.computedEntriesCache) {
    const result: BitComputedEntry<T>[] = [];
    forEachFieldConfig((cfg, path) => {
      if (cfg.computed) {
        result.push({
          path,
          compute: cfg.computed,
          dependsOn: cfg.computedDependsOn ?? cfg.conditional?.dependsOn,
        });
      }
    });
    fieldIndexState.computedEntriesCache = result;
  }

  return fieldIndexState.computedEntriesCache;
}

export function getTransformEntries<T extends object>(args: {
  fieldIndexState: BitStoreFieldIndexState<T>;
  forEachFieldConfig: (
    iteratee: (cfg: BitFieldDefinition<T>, path: string) => void,
  ) => void;
}): [string, BitTransformFn<T>][] {
  const { fieldIndexState, forEachFieldConfig } = args;

  if (!fieldIndexState.transformEntriesCache) {
    const result: [string, BitTransformFn<T>][] = [];
    forEachFieldConfig((cfg, path) => {
      if (cfg.transform) {
        result.push([path, cfg.transform]);
      }
    });
    fieldIndexState.transformEntriesCache = result;
  }

  return fieldIndexState.transformEntriesCache;
}
