import {
  BitMask,
  CurrencyMaskConfig,
  DateMaskConfig,
  PatternMaskOptions,
} from "./types";

type TokenMap = Record<string, RegExp>;

const tokens: TokenMap = {
  "#": /\d/,
  A: /[a-zA-Z]/,
  X: /[a-zA-Z0-9]/,
  H: /[0-9a-fA-F]/,
  U: /[A-Z]/,
  L: /[a-z]/,
  "*": /./,
};

export const unmask = (
  value: string | number | null | undefined,
  allowChars?: string,
): string => {
  if (value === null || value === undefined || value === "") return "";
  const stringValue = String(value);
  const isNegative = stringValue.startsWith("-");

  const escapedChars = allowChars
    ? allowChars.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    : "";
  const regex = new RegExp(`[^a-zA-Z0-9${escapedChars}]`, "g");

  const clean = stringValue.replace(regex, "");
  return isNegative && clean && !clean.startsWith("-") ? `-${clean}` : clean;
};

export const unmaskCurrency = (value: any, precision = 2): number => {
  if (typeof value === "number") return value;
  if (!value) return 0;

  const stringValue = String(value);
  const isNegative = stringValue.includes("-");
  const digits = stringValue.replace(/\D/g, "");

  if (!digits) return 0;

  const numberValue = parseInt(digits, 10) / Math.pow(10, precision);
  return isNegative ? -numberValue : numberValue;
};

export const createPatternMask = (
  pattern: string | string[],
  options?: PatternMaskOptions,
): BitMask => {
  const getRawLength = (p: string) =>
    p.split("").filter((c) => tokens[c]).length;

  return {
    format: (value: any) => {
      let stringVal = unmask(value, options?.allowChars);

      // Se não há valor e o guide não está ativo, retorna vazio logo de cara
      if (!stringVal && !options?.guide) return "";

      const patterns = Array.isArray(pattern) ? pattern : [pattern];
      const sortedPatterns = [...patterns].sort(
        (a, b) => getRawLength(a) - getRawLength(b),
      );

      let activePattern = sortedPatterns[sortedPatterns.length - 1];
      for (const p of sortedPatterns) {
        if (stringVal.length <= getRawLength(p)) {
          activePattern = p;
          break;
        }
      }

      let masked = "";
      let valueIndex = 0;

      // Variáveis do guide
      const showGuide = options?.guide || false;
      const placeholder = options?.placeholderChar || "_";

      // O loop agora corre o activePattern por inteiro se o guide for true
      for (let i = 0; i < activePattern.length; i++) {
        const patternChar = activePattern[i];
        const token = tokens[patternChar];

        if (valueIndex < stringVal.length) {
          // 1. Ainda temos texto do utilizador para processar
          let dataChar = stringVal[valueIndex];

          if (token) {
            if (patternChar === "U") dataChar = dataChar.toUpperCase();
            if (patternChar === "L") dataChar = dataChar.toLowerCase();

            if (token.test(dataChar)) {
              masked += dataChar;
              valueIndex++;
            } else {
              // Se o utilizador digitou um char inválido, ignora-o.
              // Se o guide estiver ativo, desenha o placeholder.
              if (showGuide) masked += placeholder;
              else break;
            }
          } else {
            masked += patternChar;
            if (dataChar === patternChar) valueIndex++;
          }
        } else {
          // 2. Acabou o texto do utilizador!
          if (showGuide) {
            // Se for um token (ex: #), põe o placeholder (_). Se for literal (ex: -), põe o literal.
            masked += token ? placeholder : patternChar;
          } else {
            // Se não for para mostrar o guide, terminamos a máscara aqui.
            break;
          }
        }
      }

      // Evita mostrar o guide solto se o campo estiver 100% vazio e o dev não quiser
      // (Mas por padrão, se guide é true, até o campo vazio exibe a máscara inteira)
      return masked;
    },
    parse: (value: string) => {
      if (options?.customParse) return options.customParse(value);

      const mask = createPatternMask(pattern, options);
      const formatted = mask.format(value);

      if (options?.saveRaw) {
        if (options?.guide) {
          const placeholder = options.placeholderChar || "_";
          const escapedPlaceholder = placeholder.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
          );
          const placeholderRegex = new RegExp(escapedPlaceholder, "g");

          return formatted.replace(placeholderRegex, "");
        }

        return formatted;
      }

      return unmask(formatted, options?.allowChars);
    },
  };
};

export const createCurrencyMask = ({
  prefix = "",
  suffix = "",
  thousand,
  decimal,
  precision = 2,
  allowNegative = true,
  saveRaw = false,
}: CurrencyMaskConfig): BitMask => {
  const formatFn = (value: any) => {
    if (value === undefined || value === null || value === "") return "";

    let stringValue = "";

    if (typeof value === "number") {
      stringValue = Math.abs(value).toFixed(precision).replace(/\D/g, "");
    } else {
      stringValue = String(value).replace(/\D/g, "");
    }

    if (!stringValue && String(value).includes("-") && allowNegative)
      return "-";
    if (!stringValue) return "";

    stringValue = stringValue.padStart(precision + 1, "0");

    const integerPart =
      stringValue.slice(0, -precision).replace(/^0+(?=\d)/, "") || "0";
    const decimalPart = stringValue.slice(-precision);

    const formattedInteger = integerPart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      thousand,
    );

    const isNegative =
      typeof value === "number" ? value < 0 : String(value).includes("-");
    const sign = isNegative && allowNegative ? "-" : "";

    return `${sign}${prefix}${formattedInteger}${decimal}${decimalPart}${suffix}`;
  };

  return {
    format: formatFn,
    parse: (value: string) => {
      const numericValue = unmaskCurrency(value, precision);
      const finalNumber = !allowNegative
        ? Math.abs(numericValue)
        : numericValue;
      if (saveRaw) return formatFn(finalNumber);
      return finalNumber;
    },
  };
};

export const createCreditCardMask = (options?: PatternMaskOptions): BitMask => {
  // Função auxiliar para descobrir o padrão dinamicamente
  const getCardPattern = (rawValue: string) => {
    // Amex (American Express) começa com 34 ou 37 -> 15 dígitos
    if (/^3[47]/.test(rawValue)) {
      return "#### ###### #####";
    }
    // Diners Club começa com 300-305, 36 ou 38 -> 14 dígitos
    if (/^3(?:0[0-5]|[68])/.test(rawValue)) {
      return "#### ###### ####";
    }
    // Default: Visa, Mastercard, Discover, Elo, etc -> 16 dígitos
    return "#### #### #### ####";
  };

  return {
    format: (value: any) => {
      const stringVal = unmask(value, options?.allowChars);
      const pattern = getCardPattern(stringVal);
      const mask = createPatternMask(pattern, options);
      return mask.format(value);
    },
    parse: (value: string) => {
      const stringVal = unmask(value, options?.allowChars);
      const pattern = getCardPattern(stringVal);

      const mask = createPatternMask(pattern, options);
      return mask.parse(value);
    },
  };
};

export const createDateMask = (config?: DateMaskConfig): BitMask => {
  const formatType = config?.format || "DD/MM/YYYY";
  const isISO = formatType === "YYYY-MM-DD";

  // Criamos a máscara base consoante o formato escolhido
  const baseMask = createPatternMask(
    isISO ? "####-##-##" : "##/##/####",
    config,
  );

  return {
    format: (value: any) => {
      let stringVal = unmask(value);
      if (!stringVal) return "";

      let day = "";
      let month = "";
      let year = "";

      // Separamos os componentes consoante o que o utilizador já digitou
      if (isISO) {
        year = stringVal.substring(0, 4);
        month = stringVal.substring(4, 6);
        day = stringVal.substring(6, 8);
      } else {
        day = stringVal.substring(0, 2);
        month = stringVal.substring(2, 4);
        year = stringVal.substring(4, 8);
      }

      // Validação do Dia (01 a 31)
      if (day.length === 2) {
        const d = parseInt(day, 10);
        if (d > 31) day = "31";
        if (d === 0) day = "01";
      }

      // Validação do Mês (01 a 12)
      if (month.length === 2) {
        const m = parseInt(month, 10);
        if (m > 12) month = "12";
        if (m === 0) month = "01";
      }

      // Reconstruímos a string limpa e passamos para o pattern normal
      const safeString = isISO
        ? `${year}${month}${day}`
        : `${day}${month}${year}`;

      return baseMask.format(safeString);
    },
    parse: (value: string) => {
      // Usamos a funcionalidade completa da máscara base (incluindo o saveRaw e o unmasking)
      return baseMask.parse(value);
    },
  };
};
