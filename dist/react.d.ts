import { B as BitFormStore } from './bit-store-ZXigSRPy.js';

declare function useBitField<T extends Record<string, any>, K extends keyof T>(store: BitFormStore<T>, fieldName: K): {
    value: T[K];
    error: Partial<Record<keyof T, string>>[K] | undefined;
    setValue: (val: T[K]) => Promise<void>;
    onBlur: () => void;
};
/**
 * Hook para monitorar o status global (loading, dirty, etc)
 */
declare function useBitFormStatus(store: BitFormStore<any>): {
    isDirty: boolean;
    isValidating: boolean;
    reset: () => void;
    getRawData: () => any;
};

export { useBitField, useBitFormStatus };
