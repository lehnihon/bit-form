import { signal, computed, inject, DestroyRef } from "@angular/core";
import { useBitStore } from "./provider";
import { BitMask, getDeepValue } from "../core";

export interface UseBitFieldOptions {
  mask?: BitMask | string;
  unmask?: boolean;
}

export function injectBitField<T = any>(
  path: string,
  options?: UseBitFieldOptions,
) {
  const store = useBitStore();
  const destroyRef = inject(DestroyRef);

  let activeMask: BitMask | undefined;
  const maskOption = options?.mask;

  if (maskOption) {
    if (typeof maskOption === "string") {
      activeMask = store.masks?.[maskOption];
      if (!activeMask) {
        console.warn(`[BitForm] Máscara '${maskOption}' não encontrada.`);
      }
    } else {
      activeMask = maskOption;
    }
  }

  const shouldUnmask = options?.unmask ?? store.defaultUnmask ?? true;

  const state = signal(store.getState());

  const unsubscribe = store.subscribe(() => {
    state.set({ ...store.getState() });
  });

  destroyRef.onDestroy(() => unsubscribe());

  const rawValue = computed(() => getDeepValue(state().values, path) as T);

  const displayValue = computed(() => {
    const val = rawValue();
    if (val === undefined || val === null) return "";

    if (activeMask) {
      return shouldUnmask ? activeMask.format(val) : String(val);
    }
    return val;
  });

  const error = computed(() => {
    const s = state();
    return s.touched[path] ? s.errors[path] : undefined;
  });

  const touched = computed(() => !!state().touched[path]);
  const invalid = computed(() => !!(touched() && error()));

  const isDirty = computed(() => {
    state();
    return store.isFieldDirty(path);
  });

  const setValue = (val: any) => {
    if (!activeMask) {
      store.setField(path, val);
      return;
    }

    if (shouldUnmask) {
      store.setField(path, activeMask.parse(val));
    } else {
      store.setField(path, activeMask.format(val));
    }
  };

  const setBlur = () => {
    store.blurField(path);
  };

  const onInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    setValue(target.value);
  };

  return {
    value: rawValue,
    displayValue,
    error,
    touched,
    invalid,
    isDirty,
    setValue,
    setBlur,
    onInput,
    props: {
      value: displayValue,
      onBlur: setBlur,
      onInput: onInput,
    },
  };
}
