import { createCurrencyMask, createPatternMask } from "./creators";

// ==========================================
// 💲 MOEDAS (Currencies)
// ==========================================

/** BRL - Real Brasileiro (R$ 1.000,00) */
export const maskBRL = createCurrencyMask({
  prefix: "R$ ",
  thousand: ".",
  decimal: ",",
  precision: 2,
});

/** USD - Dólar Americano ($1,000.00) */
export const maskUSD = createCurrencyMask({
  prefix: "$",
  thousand: ",",
  decimal: ".",
  precision: 2,
});

/** EUR - Euro Padrão (€ 1.000,00) - Sufixo comum na Europa */
export const maskEUR = createCurrencyMask({
  suffix: " €",
  thousand: ".",
  decimal: ",",
  precision: 2,
});

/** GBP - Libra Esterlina (£1,000.00) */
export const maskGBP = createCurrencyMask({
  prefix: "£",
  thousand: ",",
  decimal: ".",
  precision: 2,
});

/** JPY - Iene Japonês (¥1,000) - Geralmente sem decimais */
export const maskJPY = createCurrencyMask({
  prefix: "¥",
  thousand: ",",
  decimal: ".",
  precision: 0,
});

// ==========================================
// 🔢 NÚMEROS E PERCENTUAIS
// ==========================================

/** Porcentagem PT-BR (10,5%) */
export const maskPercent = createCurrencyMask({
  suffix: "%",
  thousand: ".",
  decimal: ",",
  precision: 1, // Ex: 99,9%
});

/** Decimal Genérico PT-BR (1.000,00) - Sem símbolo */
export const maskDecimal = createCurrencyMask({
  thousand: ".",
  decimal: ",",
  precision: 2,
});

/** Inteiro (1.000) - Apenas separador de milhar */
export const maskInteger = createCurrencyMask({
  thousand: ".",
  decimal: ",",
  precision: 0,
});

// ==========================================
// 🇧🇷 PADRÕES BRASILEIROS (Brazil)
// ==========================================

/** CPF (000.000.000-00) */
export const maskCPF = createPatternMask("###.###.###-##");

/** CNPJ (00.000.000/0000-00) */
export const maskCNPJ = createPatternMask("##.###.###/####-##");

/** Telefone Celular BR (11) 90000-0000 */
export const maskPhone = createPatternMask("(##) #####-####");

/** Telefone Fixo BR (11) 0000-0000 */
export const maskLandline = createPatternMask("(##) ####-####");

/** CEP (00000-000) */
export const maskCEP = createPatternMask("#####-###");

/** Data BR (DD/MM/AAAA) */
export const maskDate = createPatternMask("##/##/####");

/** Hora Curta (HH:MM) */
export const maskTime = createPatternMask("##:##");

/** CNH (Carteira de Motorista - 11 dígitos) */
export const maskCNH = createPatternMask("###########");

/** RG (00.000.000-X) - Suporta o 'X' como dígito verificador */
export const maskRG = createPatternMask("##.###.###-X");

// ==========================================
// 🇺🇸 PADRÕES AMERICANOS (USA)
// ==========================================

/** US Phone ((000) 000-0000) */
export const maskUSPhone = createPatternMask("(###) ###-####");

/** ZIP Code (00000 or 00000-0000) */
export const maskZipCode = createPatternMask("#####-####");

/** Date US (MM/DD/YYYY) - Igual ao BR, mas semântica diferente */
export const maskDateUS = createPatternMask("##/##/####");

/** SSN (Social Security Number) */
export const maskSSN = createPatternMask("###-##-####");

// ==========================================
// 🌐 PADRÕES GLOBAIS / TÉCNICOS
// ==========================================

/** Cartão de Crédito (0000 0000 0000 0000) */
export const maskCreditCard = createPatternMask("#### #### #### ####");

/** CVV (3 ou 4 dígitos) */
export const maskCVV = createPatternMask("####");

/** Data ISO (AAAA-MM-DD) */
export const maskDateISO = createPatternMask("####-##-##");

/** Endereço MAC (HH:HH:HH:HH:HH:HH) - Usa o token Hexadecimal */
export const maskMacAddress = createPatternMask("HH:HH:HH:HH:HH:HH");

/** Cor Hexadecimal (#HHHHHH) */
export const maskColorHex = createPatternMask("#HHHHHH");

/** IPv4 (000.000.000.000) - Formato de blocos fixos */
export const maskIPv4 = createPatternMask("###.###.###.###");

/** IPv6 (HHHH:HHHH:HHHH:HHHH:HHHH:HHHH:HHHH:HHHH) */
export const maskIPv6 = createPatternMask(
  "HHHH:HHHH:HHHH:HHHH:HHHH:HHHH:HHHH:HHHH",
);
