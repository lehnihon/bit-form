import { getDeepValue } from "../../utils";
import type {
  BitFieldState,
  BitPath,
  BitPathValue,
  BitPersistMetadata,
  BitState,
} from "../contracts/types";
import { createFieldStateSnapshot } from "../engines/store-field-query-engine";

interface BitStoreStateReaderDeps<T extends object> {
  getState(): Readonly<BitState<T>>;
  isHidden(path: string): boolean;
  isRequired(path: string): boolean;
  isFieldDirty(path: string): boolean;
  isFieldValidating(path: string): boolean;
}

type BitStateFlagKey = "isValid" | "isSubmitting" | "isDirty";

export interface BitUserStateLayer<T extends object> {
  values: T;
  touched: BitState<T>["touched"];
}

export interface BitValidationStateLayer<T extends object> {
  errors: BitState<T>["errors"];
  isValidating: BitState<T>["isValidating"];
  isValid: BitState<T>["isValid"];
}

export interface BitDerivedStateLayer {
  isDirty: boolean;
}

export interface BitFeatureStateLayer<T extends object> {
  persist: BitState<T>["persist"];
  isSubmitting: BitState<T>["isSubmitting"];
}

export class BitStoreStateReader<T extends object> {
  private readonly fieldStateCache = new Map<
    string,
    {
      state: Readonly<BitState<T>>;
      snapshot: Readonly<BitFieldState<T, unknown>>;
    }
  >();
  private persistMetaCache:
    | {
        state: Readonly<BitState<T>>;
        snapshot: BitPersistMetadata;
      }
    | undefined;

  constructor(private readonly deps: BitStoreStateReaderDeps<T>) {}

  getState(): Readonly<BitState<T>> {
    return this.deps.getState();
  }

  getUserLayer(): BitUserStateLayer<T> {
    const state = this.deps.getState();

    return {
      values: state.values,
      touched: state.touched,
    };
  }

  getValidationLayer(): BitValidationStateLayer<T> {
    const state = this.deps.getState();

    return {
      errors: state.errors,
      isValidating: state.isValidating,
      isValid: state.isValid,
    };
  }

  getDerivedLayer(): BitDerivedStateLayer {
    return {
      isDirty: this.deps.getState().isDirty,
    };
  }

  getFeatureLayer(): BitFeatureStateLayer<T> {
    const state = this.deps.getState();

    return {
      persist: state.persist,
      isSubmitting: state.isSubmitting,
    };
  }

  getFlag<TKey extends BitStateFlagKey>(
    key: TKey,
  ): Readonly<BitState<T>>[TKey] {
    return this.deps.getState()[key];
  }

  getPersistMetadata(): BitPersistMetadata {
    const state = this.deps.getState();
    const persist = state.persist;
    const cached = this.persistMetaCache;

    if (
      cached &&
      cached.state === state &&
      cached.snapshot.isSaving === persist.isSaving &&
      cached.snapshot.isRestoring === persist.isRestoring &&
      cached.snapshot.error === persist.error
    ) {
      return cached.snapshot;
    }

    const snapshot: BitPersistMetadata = {
      isSaving: persist.isSaving,
      isRestoring: persist.isRestoring,
      error: persist.error,
    };

    this.persistMetaCache = {
      state,
      snapshot,
    };

    return snapshot;
  }

  getFieldState<P extends BitPath<T>>(
    path: P,
  ): Readonly<BitFieldState<T, BitPathValue<T, P>>> {
    const pathKey = path as string;
    const state = this.deps.getState();
    const cached = this.fieldStateCache.get(pathKey);

    const value = getDeepValue(state.values, pathKey) as BitPathValue<T, P>;
    const error = state.errors[pathKey as keyof typeof state.errors];
    const touched = !!state.touched[pathKey as keyof typeof state.touched];
    const isHidden = this.deps.isHidden(pathKey);
    const isRequired = this.deps.isRequired(pathKey);
    const isDirty = this.deps.isFieldDirty(pathKey);
    const isValidating = this.deps.isFieldValidating(pathKey);

    if (cached) {
      const snapshot = cached.snapshot;

      if (
        snapshot.value === value &&
        snapshot.error === error &&
        snapshot.touched === touched &&
        snapshot.isHidden === isHidden &&
        snapshot.isRequired === isRequired &&
        snapshot.isDirty === isDirty &&
        snapshot.isValidating === isValidating
      ) {
        return snapshot as Readonly<BitFieldState<T, BitPathValue<T, P>>>;
      }
    }

    const snapshot = createFieldStateSnapshot({
      state,
      path,
      value,
      isHidden,
      isRequired,
      isDirty,
      isValidating,
    });

    this.fieldStateCache.set(pathKey, {
      state,
      snapshot: snapshot as Readonly<BitFieldState<T, unknown>>,
    });

    return snapshot;
  }

  invalidatePath(path: string): void {
    this.fieldStateCache.delete(path);
  }

  invalidatePathTree(parentPath: string): void {
    const prefix = `${parentPath}.`;
    for (const key of this.fieldStateCache.keys()) {
      if (key === parentPath || key.startsWith(prefix)) {
        this.fieldStateCache.delete(key);
      }
    }
  }
}
