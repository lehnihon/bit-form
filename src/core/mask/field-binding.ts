import type { BitMask } from "./types";

/**
 * Tipo de entrada aceito pelos handlers de campo.
 * Cobre eventos nativos (`e.target.value`), eventos sintéticos e valores diretos.
 * Definido aqui para ser compartilhado entre todos os frameworks.
 */
export type BitFieldInputEvent =
  | { target?: { value?: string | number | null } }
  | string
  | number
  | null
  | undefined;

/**
 * Type guard: verifica se o valor de entrada é um objeto de evento
 * (com propriedade `target`), diferenciando-o de um valor direto.
 */
export function isBitFieldInputEventObject(
  value: BitFieldInputEvent,
): value is Extract<
  BitFieldInputEvent,
  { target?: { value?: string | number | null } }
> {
  return value != null && typeof value === "object" && "target" in value;
}

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
