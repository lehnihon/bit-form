export * from "./types";
export * from "./creators";
export * from "./presets";
export * from "./field-binding";

import * as presets from "./presets";
import type { BitMask, BitBuiltInMaskName } from "./types";

export const bitMasks: Record<BitBuiltInMaskName, BitMask> = {
  // Moedas
  brl: presets.maskBRL,
  usd: presets.maskUSD,
  eur: presets.maskEUR,
  gbp: presets.maskGBP,
  jpy: presets.maskJPY,
  // Números
  percent: presets.maskPercent,
  decimal: presets.maskDecimal,
  int: presets.maskInteger,
  integer: presets.maskInteger,
  // Documentos BR
  cpf: presets.maskCPF,
  cnpj: presets.maskCNPJ,
  cpfCnpj: presets.maskCPFCNPJ,
  rg: presets.maskRG,
  cep: presets.maskCEP,
  cnh: presets.maskCNH,
  plate: presets.maskPlate,
  // Comunicação/Data
  phone: presets.maskPhone,
  landline: presets.maskLandline,
  date: presets.maskDate,
  time: presets.maskTime,
  // USA
  usPhone: presets.maskUSPhone,
  zipCode: presets.maskZipCode,
  dateUS: presets.maskDateUS,
  ssn: presets.maskSSN,
  // Tech/Global
  cc: presets.maskCreditCard,
  cvv: presets.maskCVV,
  dateISO: presets.maskDateISO,
  ip: presets.maskIPv4,
  ipv6: presets.maskIPv6,
  mac: presets.maskMacAddress,
  color: presets.maskColorHex,
  iban: presets.maskIBAN,
};
