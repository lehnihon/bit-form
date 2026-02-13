export interface BitMask {
  format: (value: any) => string;
  parse: (value: string) => any;
}

export interface CurrencyConfig {
  symbol: string;
  thousand: string;
  decimal: string;
  precision?: number;
}
