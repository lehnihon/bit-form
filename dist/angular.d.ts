import { Signal } from '@angular/core';
import { B as BitFormStore } from './bit-store-ZXigSRPy.js';

declare function createBitSignal<T extends Record<string, any>, K extends keyof T>(store: BitFormStore<T>, fieldName: K): {
    value: Signal<T[K]>;
    error: Signal<string | undefined>;
    setValue: (val: T[K]) => Promise<void>;
    onBlur: () => void;
};
declare function useBitFormStatus(store: BitFormStore<any>): {
    isDirty: Signal<boolean>;
    isValidating: Signal<boolean>;
    reset: () => void;
};

export { createBitSignal, useBitFormStatus };
