import type { BitMask } from "./types";

export const formatMaskedValue = (value: unknown, mask?: BitMask): string => {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  return mask ? mask.format(value) : String(value);
};

export const parseMaskedInput = (value: unknown, mask?: BitMask): unknown => {
  if (!mask) {
    return value;
  }

  return mask.parse(String(value ?? ""));
};
