export interface BitMask {
  format: (value: any) => string;
  parse: (value: string) => any;
}

export interface PatternMaskOptions {
  allowChars?: string;
  customParse?: (value: string) => any;
  saveRaw?: boolean;
  guide?: boolean;
  placeholderChar?: string;
}

export interface CurrencyMaskConfig {
  prefix?: string;
  suffix?: string;
  thousand: string;
  decimal: string;
  precision?: number;
  allowNegative?: boolean;
  saveRaw?: boolean;
}

export interface DateMaskConfig extends PatternMaskOptions {
  format?: "DD/MM/YYYY" | "YYYY-MM-DD";
}
