import { computed, onUnmounted, shallowRef } from "vue";
import { useBitStore } from "./context";
import { BitFieldOptions, getDeepValue } from "../core";

export function useBitField<T extends object = any>(
  path: string,
  options?: BitFieldOptions<T>,
) {
  const store = useBitStore();

  if (options?.dependsOn || options?.showIf || options?.requiredIf) {
    store.registerConfig(path, {
      dependsOn: options.dependsOn,
      showIf: options.showIf,
      requiredIf: options.requiredIf,
    } as any);
  }

  const resolvedMask = options?.mask
    ? typeof options.mask === "string"
      ? store.masks?.[options.mask]
      : options.mask
    : undefined;

  const shouldUnmask = options?.unmask ?? store.defaultUnmask ?? true;

  const state = shallowRef(store.getState());

  const unsubscribe = store.subscribe(() => {
    state.value = store.getState();
  });

  onUnmounted(unsubscribe);

  const rawValue = computed(() => {
    return getDeepValue(state.value.values, path) as any;
  });

  const displayValue = computed(() => {
    const val = rawValue.value;
    if (val === undefined || val === null) return "";

    if (resolvedMask) {
      return resolvedMask.format(val);
    }
    return String(val);
  });

  const value = computed({
    get: () => displayValue.value,
    set: (val: any) => {
      if (!resolvedMask) {
        store.setField(path, val);
        return;
      }

      if (shouldUnmask) {
        store.setField(path, resolvedMask.parse(String(val)));
      } else {
        store.setField(path, resolvedMask.format(String(val)));
      }
    },
  });

  const error = computed(() => {
    return state.value.touched[path] ? state.value.errors[path] : undefined;
  });

  const touched = computed(() => !!state.value.touched[path]);
  const invalid = computed(() => !!(touched.value && error.value));

  const isDirty = computed(() => {
    state.value;
    return store.isFieldDirty(path);
  });

  const isHidden = computed(() => {
    state.value;
    return store.isHidden(path);
  });

  const setBlur = () => store.blurField(path);

  return {
    value,
    displayValue,
    error,
    touched,
    invalid,
    isDirty,
    isHidden,
    setBlur,
    setValue: (val: any) => (value.value = val),
  };
}
