import * as _vue_shared from '@vue/shared';
import * as vue from 'vue';
import { B as BitFormStore } from './bit-store-ZXigSRPy.cjs';

declare function useBitField<T extends Record<string, any>, K extends keyof T>(store: BitFormStore<T>, fieldName: K): {
    value: [T[K]] extends [vue.Ref<any, any>] ? _vue_shared.IfAny<T[K], vue.Ref<T[K], T[K]>, T[K]> : vue.Ref<vue.UnwrapRef<T[K]>, T[K] | vue.UnwrapRef<T[K]>>;
    error: vue.ComputedRef<string | undefined>;
    setValue: (val: T[K]) => Promise<void>;
    onBlur: () => void;
};
declare function useBitFormStatus(store: BitFormStore<any>): {
    isDirty: Readonly<vue.Ref<boolean, boolean>>;
    isValidating: Readonly<vue.Ref<boolean, boolean>>;
    reset: () => void;
};

export { useBitField, useBitFormStatus };
