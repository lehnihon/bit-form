export { bitMasks } from "./core/mask/index";

export type {
  BitMask,
  BitMaskName,
  BitBuiltInMaskName,
  CurrencyMaskConfig,
  PatternMaskOptions,
  DateMaskConfig,
} from "./core/mask/types";

export {
  unmask,
  unmaskCurrency,
  createPatternMask,
  createCurrencyMask,
  createCreditCardMask,
  createDateMask,
} from "./core/mask/creators";

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
} from "./core/mask/presets";
