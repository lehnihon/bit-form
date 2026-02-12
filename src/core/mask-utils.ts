type TokenMap = Record<string, RegExp>;

const tokens: TokenMap = {
  "#": /\d/,
  A: /[a-zA-Z]/,
  X: /[a-zA-Z0-9]/,
  S: /[a-zA-Z0-9]/,
};

interface CurrencyConfig {
  symbol: string;
  thousand: string;
  decimal: string;
  precision?: number;
}

export const unmask = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "";
  const stringValue = String(value);
  const isNegative = stringValue.startsWith("-");
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
export const createPatternMask = (pattern: string) => {
  return (value: string | null | undefined) => {
    if (!value) return "";

    const cleanValue = value.replace(/[^a-zA-Z0-9]/g, "");
    let masked = "";
    let valueIndex = 0;

    for (let i = 0; i < pattern.length && valueIndex < cleanValue.length; i++) {
      const patternChar = pattern[i];
      const token = tokens[patternChar];
      const dataChar = cleanValue[valueIndex];

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
  };
};

export const createCurrencyMask = ({
  symbol,
  thousand,
  decimal,
  precision = 2,
}: CurrencyConfig) => {
  return (value: number | string | null | undefined) => {
    if (value === undefined || value === null || value === "") return "";

    let stringValue =
      typeof value === "number"
        ? value.toFixed(precision).replace(".", "")
        : String(value);

    const isNegative = stringValue.includes("-");
    const cleanValue = stringValue.replace(/\D/g, "");

    if (!cleanValue) return isNegative ? "-" : "";

    const divider = Math.pow(10, precision);
    const amount = (parseInt(cleanValue, 10) / divider).toFixed(precision);

    const [integerPart, decimalPart] = amount.split(".");
    const formattedInteger = integerPart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      thousand,
    );

    const sign = isNegative ? "-" : "";
    const result = `${sign}${symbol} ${formattedInteger}${decimal}${decimalPart}`;

    return result.trim();
  };
};

export const maskBRL = createCurrencyMask({
  symbol: "R$",
  thousand: ".",
  decimal: ",",
});
export const maskUSD = createCurrencyMask({
  symbol: "$",
  thousand: ",",
  decimal: ".",
});
