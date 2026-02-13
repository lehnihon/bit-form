import { BitMask, CurrencyConfig } from "./types";

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

export interface ExtendedCurrencyConfig extends Omit<CurrencyConfig, "symbol"> {
  prefix?: string;
  suffix?: string;
  allowNegative?: boolean;
}

export const unmask = (
  value: string | number | null | undefined,
  allowChars?: string,
): string => {
  if (value === null || value === undefined || value === "") return "";
  const stringValue = String(value);
  const isNegative = stringValue.startsWith("-");

  if (allowChars) {
    const escapedChars = allowChars.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`[^a-zA-Z0-9${escapedChars}]`, "g");
    const clean = stringValue.replace(regex, "");
    return isNegative && !clean.startsWith("-") ? `-${clean}` : clean;
  }

  const clean = stringValue.replace(/[^a-zA-Z0-9]/g, "");
  return isNegative && clean ? `-${clean}` : clean;
};

export const unmaskCurrency = (value: any, precision = 2): number => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;

  const stringValue = String(value);
  const isNegative = stringValue.includes("-");
  const digits = stringValue.replace(/\D/g, "");

  if (!digits) return 0;

  const numberValue = parseInt(digits, 10) / Math.pow(10, precision);
  return isNegative ? -numberValue : numberValue;
};

export const createPatternMask = (pattern: string): BitMask => {
  return {
    format: (value: any) => {
      const fixedChars = pattern.replace(/[#09ASXULH*]/g, "");
      const stringVal = unmask(value, fixedChars);

      if (!stringVal) return "";

      let masked = "";
      let valueIndex = 0;

      for (
        let i = 0;
        i < pattern.length && valueIndex < stringVal.length;
        i++
      ) {
        const patternChar = pattern[i];
        const token = tokens[patternChar];
        const dataChar = stringVal[valueIndex];

        if (token) {
          if (token.test(dataChar)) {
            masked += dataChar;
            valueIndex++;
          } else {
            break;
          }
        } else {
          masked += patternChar;
          if (dataChar === patternChar) valueIndex++;
        }
      }
      return masked;
    },
    parse: (value: string) => unmask(value),
  };
};

export const createCurrencyMask = ({
  prefix = "",
  suffix = "",
  thousand,
  decimal,
  precision = 2,
  allowNegative = true,
}: ExtendedCurrencyConfig): BitMask => {
  return {
    format: (value: any) => {
      if (value === undefined || value === null || value === "") return "";

      let stringValue =
        typeof value === "number"
          ? value.toFixed(precision).replace(".", "")
          : String(value);

      const isNegative = stringValue.includes("-");
      const cleanValue = stringValue.replace(/\D/g, "");

      if (!cleanValue) return isNegative && allowNegative ? "-" : "";

      const divider = Math.pow(10, precision);
      const amount = (parseInt(cleanValue, 10) / divider).toFixed(precision);

      const [integerPart, decimalPart] = amount.split(".");
      const formattedInteger = integerPart.replace(
        /\B(?=(\d{3})+(?!\d))/g,
        thousand,
      );

      const sign = isNegative && allowNegative ? "-" : "";

      return `${sign}${prefix}${formattedInteger}${decimal}${decimalPart}${suffix}`;
    },
    parse: (value: string) => {
      const numericValue = unmaskCurrency(value, precision);
      return !allowNegative ? Math.abs(numericValue) : numericValue;
    },
  };
};
