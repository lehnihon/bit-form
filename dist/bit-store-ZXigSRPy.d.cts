type MaskFn = (value: any) => any;
type UnmaskFn = (value: any) => any;
type ValidatorFn<T> = (values: T) => Partial<Record<keyof T, string>> | Promise<Partial<Record<keyof T, string>>>;
interface BitOptions<T> {
    masks?: Partial<Record<keyof T, MaskFn>>;
    unmasks?: Partial<Record<keyof T, UnmaskFn>>;
    validator?: ValidatorFn<T>;
}
declare class BitFormStore<T extends Record<string, any>> {
    private initialValues;
    private state;
    private touched;
    private errors;
    private masks;
    private unmasks;
    private validator?;
    isValidating: boolean;
    private listeners;
    constructor(initialValues: T, options?: BitOptions<T>);
    getState: () => T;
    getErrors: () => Partial<Record<keyof T, string>>;
    getTouched: () => Partial<Record<keyof T, boolean>>;
    isDirty: () => boolean;
    getRawState: () => T;
    setState: (nextState: Partial<T>) => Promise<void>;
    markTouched: (field: keyof T) => void;
    reset: () => void;
    subscribe: (listener: () => void) => () => boolean;
    private notify;
    private applyMasks;
    private validate;
}

export { BitFormStore as B, type MaskFn as M, type UnmaskFn as U, type ValidatorFn as V, type BitOptions as a };
