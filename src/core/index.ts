export { createBitStore } from "./store/create-store";
export type {
  BitPublicStore,
  BitFrameworkStore,
  BitFrameworkConfig,
} from "./store/public-types";

export { bitBus } from "./store/bus";

export {
  getDeepValue,
  setDeepValue,
  deepClone,
  deepEqual,
  valueEqual,
  cleanPrefixedKeys,
  isValidationErrorShape,
  extractServerErrors,
} from "./utils";

export type {
  BitConfig,
  BitValidationConfig,
  BitHistoryConfig,
  BitState,
  BitErrors,
  BitTouched,
  BitFieldDefinition,
  BitFieldConditional,
  BitFieldValidation,
  ValidatorFn,
  BitComputedFn,
  BitTransformFn,
  BitPath,
  BitPathValue,
  BitArrayPath,
  BitArrayItem,
  ScopeStatus,
  ValidateScopeResult,
  DeepPartial,
  BitPersistConfig,
  BitPersistStorageAdapter,
  BitPersistMode,
} from "./store/types";

export { bitMasks } from "./mask/index";
export type {
  BitMask,
  CurrencyMaskConfig,
  PatternMaskOptions,
  DateMaskConfig,
} from "./mask/types";

export {
  unmask,
  unmaskCurrency,
  createPatternMask,
  createCurrencyMask,
  createCreditCardMask,
  createDateMask,
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
  maskIBAN,
} from "./mask/presets";

export type {
  BitUploadFn,
  BitDeleteUploadFn,
  BitUploadResult,
} from "./upload/types";
