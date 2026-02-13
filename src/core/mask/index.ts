export * from "./types";
export * from "./creators";
export * from "./presets";

import * as presets from "./presets";

export const bitMasks = {
  // Moedas
  brl: presets.maskBRL,
  usd: presets.maskUSD,
  eur: presets.maskEUR,
  gbp: presets.maskGBP,
  jpy: presets.maskJPY,
  // Documentos BR
  cpf: presets.maskCPF,
  cnpj: presets.maskCNPJ,
  rg: presets.maskRG,
  cep: presets.maskCEP,
  cnh: presets.maskCNH,
  // Comunicação/Data
  phone: presets.maskPhone,
  landline: presets.maskLandline,
  date: presets.maskDate,
  time: presets.maskTime,
  // Tech/Global
  ip: presets.maskIPv4,
  ipv6: presets.maskIPv6,
  mac: presets.maskMacAddress,
  color: presets.maskColorHex,
  cc: presets.maskCreditCard,
  cvv: presets.maskCVV,
  // Utilitários
  percent: presets.maskPercent,
  decimal: presets.maskDecimal,
  int: presets.maskInteger,
};
