export { B as BitFormStore, a as BitOptions, M as MaskFn, U as UnmaskFn, V as ValidatorFn } from './bit-store-ZXigSRPy.js';

declare const createPatternMask: (pattern: string) => (value: string) => string;
declare const currencyMask: (value: number | string) => string;

export { createPatternMask, currencyMask };
