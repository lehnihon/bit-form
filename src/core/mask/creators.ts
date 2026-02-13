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

export const createPatternMask = (pattern: string): BitMask => {
  return {
    format: (value: any) => {
      let stringVal = unmask(value);
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
        let dataChar = stringVal[valueIndex];

        if (token) {
          if (patternChar === "U") dataChar = dataChar.toUpperCase();
          if (patternChar === "L") dataChar = dataChar.toLowerCase();

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
    parse: (value: string) => {
      const mask = createPatternMask(pattern);
      return unmask(mask.format(value));
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
}: ExtendedCurrencyConfig): BitMask => {
  return {
    format: (value: any) => {
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
    },
    parse: (value: string) => {
      const numericValue = unmaskCurrency(value, precision);
      return !allowNegative ? Math.abs(numericValue) : numericValue;
    },
  };
};
