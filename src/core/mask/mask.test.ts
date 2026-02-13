import { describe, it, expect } from "vitest";
import {
  createPatternMask,
  createCurrencyMask,
  maskBRL,
  maskUSD,
  maskEUR,
  maskIPv4,
  maskCPF,
  unmask,
  unmaskCurrency,
} from "../../core/mask";

describe("Mask Utils - Patterns", () => {
  it("should respect standard tokens (#, A, X)", () => {
    const mask = createPatternMask("AAA-####-X");
    // Agora chamamos .format()
    expect(mask.format("abc1234z")).toBe("abc-1234-z");
    expect(mask.format("123-abc")).toBe(""); // Números onde deveriam ser letras
  });

  it("should handle fixed characters correctly", () => {
    const mask = createPatternMask("+55 (##) #####-####");
    expect(mask.format("11988887777")).toBe("+55 (11) 98888-7777");
  });

  it("should handle new international tokens (H, U, L)", () => {
    // H = Hexadecimal (0-9, A-F)
    const hexMask = createPatternMask("#HHHHHH");
    expect(hexMask.format("FF00GG")).toBe("FF00"); // G é inválido para Hex

    // U = Uppercase Only
    const upperMask = createPatternMask("UUU");
    expect(upperMask.format("abc")).toBe(""); // Bloqueia minúsculas
    expect(upperMask.format("ABC")).toBe("ABC");
  });

  it("should parse values correctly (clean unmask)", () => {
    expect(maskCPF.parse("111.222.333-44")).toBe("11122233344");
    expect(maskIPv4.parse("192.168.0.1")).toBe("19216801");
  });
});

describe("Mask Utils - Currency & Numbers", () => {
  it("should format BRL with prefix", () => {
    expect(maskBRL.format("123456")).toBe("R$ 1.234,56");
    expect(maskBRL.format("-123456")).toBe("-R$ 1.234,56");
  });

  it("should format USD with prefix", () => {
    expect(maskUSD.format("100050")).toBe("$1,000.50");
    expect(maskUSD.format("-100050")).toBe("-$1,000.50");
  });

  it("should format EUR with suffix", () => {
    // maskEUR foi definida com suffix: " €"
    expect(maskEUR.format("5000")).toBe("50,00 €");
  });

  it("should handle allowNegative option", () => {
    const positiveOnly = createCurrencyMask({
      thousand: ".",
      decimal: ",",
      allowNegative: false,
    });

    expect(positiveOnly.format("-100")).toBe("1,00"); // Ignora o sinal
    expect(positiveOnly.parse("-100")).toBe(1); // Parse também retorna absoluto
  });

  it("should parse currency strings back to float numbers", () => {
    expect(maskBRL.parse("R$ 1.200,50")).toBe(1200.5);
    expect(maskUSD.parse("-$ 1,000.50")).toBe(-1000.5);
    // Teste com sufixo
    expect(maskEUR.parse("50,00 €")).toBe(50.0);
  });

  it("should return correct sign when input is just a minus", () => {
    expect(maskBRL.format("-")).toBe("-");
  });
});

describe("Mask Utils - Unmasking Helpers", () => {
  it("should clean strings to raw alphanumeric", () => {
    expect(unmask("(11) 9999-9999")).toBe("1199999999");
    expect(unmask("FIA-6208")).toBe("FIA6208");
  });

  it("should support allowedChars exception list", () => {
    // Novo recurso: permitir caracteres específicos
    expect(unmask("123.456", ".")).toBe("123.456");
    expect(unmask("ABC-123", "-")).toBe("ABC-123");
    // Se não permitir, remove
    expect(unmask("123.456")).toBe("123456");
  });

  it("should convert currency strings to float numbers directly", () => {
    expect(unmaskCurrency("R$ 1.200,50")).toBe(1200.5);
    expect(unmaskCurrency("-R$ 50,00")).toBe(-50.0);
    expect(unmaskCurrency("")).toBe(0);
  });
});
