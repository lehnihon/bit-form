export { BitStore } from "./store/index";

export { bitBus } from "./store/bus";

export {
  getDeepValue,
  setDeepValue,
  deepClone,
  deepEqual,
  cleanPrefixedKeys,
} from "./store/utils";

export type {
  BitConfig,
  BitState,
  BitErrors,
  BitTouched,
  BitFieldConfig,
  BitFieldOptions,
  ValidatorFn,
  BitComputedFn,
  BitTransformFn,
} from "./store/types";

export { bitMasks } from "./mask/index";
export type { BitMask, CurrencyMaskConfig } from "./mask/types";

export {
  unmask,
  unmaskCurrency,
  createPatternMask,
  createCurrencyMask,
} from "./mask/creators";

export {
  maskBRL,
  maskUSD,
  maskEUR,
  maskGBP,
  maskJPY,
  maskPercent,
  maskDecimal,
  maskInteger,
  maskCPF,
  maskCNPJ,
  maskPhone,
  maskLandline,
  maskCEP,
  maskDate,
  maskTime,
  maskCNH,
  maskRG,
  maskUSPhone,
  maskZipCode,
  maskDateUS,
  maskSSN,
  maskCreditCard,
  maskCVV,
  maskDateISO,
  maskMacAddress,
  maskColorHex,
  maskIPv4,
  maskIPv6,
} from "./mask/presets";
