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

export class BitStoreStateReader<T extends object> {
  private readonly fieldStateCache = new Map<
    string,
    {
      state: Readonly<BitState<T>>;
      snapshot: Readonly<BitFieldState<T, unknown>>;
    }
  >();

  constructor(private readonly deps: BitStoreStateReaderDeps<T>) {}

  getState(): Readonly<BitState<T>> {
    return this.deps.getState();
  }

  getFlag<TKey extends BitStateFlagKey>(
    key: TKey,
  ): Readonly<BitState<T>>[TKey] {
    return this.deps.getState()[key];
  }

  getPersistMetadata(): BitPersistMetadata {
    return this.deps.getState().persist;
  }

  getFieldState<P extends BitPath<T>>(
    path: P,
  ): Readonly<BitFieldState<T, BitPathValue<T, P>>> {
    const pathKey = path as string;
    const state = this.deps.getState();
    const cached = this.fieldStateCache.get(pathKey);

    if (cached?.state === state) {
      return cached.snapshot as Readonly<BitFieldState<T, BitPathValue<T, P>>>;
    }

    const value = getDeepValue(state.values, pathKey) as BitPathValue<T, P>;
    const snapshot = createFieldStateSnapshot({
      state,
      path,
      value,
      isHidden: this.deps.isHidden(pathKey),
      isRequired: this.deps.isRequired(pathKey),
      isDirty: this.deps.isFieldDirty(pathKey),
      isValidating: this.deps.isFieldValidating(pathKey),
    });

    this.fieldStateCache.set(pathKey, {
      state,
      snapshot: snapshot as Readonly<BitFieldState<T, unknown>>,
    });

    return snapshot;
  }
}
