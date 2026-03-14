export { createBitStore } from "./store/create-store";
export type {
  BitStoreApi,
  BitStoreHooksApi,
  BitFrameworkConfig,
  BitValidationOptions,
  BitHistoryMetadata,
  BitPersistMetadata,
  BitSelector,
  BitEqualityFn,
  BitSelectorSubscriptionOptions,
} from "./store/public-types";

export { bitBus } from "./store/bus";

export {
  getDeepValue,
  setDeepValue,
  deepClone,
  deepMerge,
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
  BitFieldState,
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
  BitPlugin,
  BitPluginContext,
  BitPluginHooks,
  BitPluginErrorEvent,
  BitFieldChangeEvent,
  BitFieldChangeMeta,
  BitBeforeValidateEvent,
  BitAfterValidateEvent,
  BitBeforeSubmitEvent,
  BitAfterSubmitEvent,
} from "./store/types";

export { bitMasks } from "./mask/index";
export type {
  BitMask,
  BitMaskName,
  BitBuiltInMaskName,
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
  maskCPFCNPJ,
  maskPhone,
  maskLandline,
  maskCEP,
  maskDate,
  maskTime,
  maskCNH,
  maskRG,
  maskPlate,
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
