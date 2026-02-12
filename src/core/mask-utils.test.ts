import { describe, it, expect } from "vitest";
import {
  createPatternMask,
  maskBRL,
  maskUSD,
  unmask,
  unmaskCurrency,
} from "./mask-utils";

describe("Mask Utils - Patterns", () => {
  it("should respect tokens (#, A, X)", () => {
    const mask = createPatternMask("AAA-####-X");
    expect(mask("abc1234z")).toBe("abc-1234-z");
    expect(mask("123-abc")).toBe("");
  });

  it("should handle fixed characters correctly", () => {
    const mask = createPatternMask("+55 (##) #####-####");
    expect(mask("11988887777")).toBe("+55 (11) 98888-7777");
  });
});

describe("Mask Utils - Currency", () => {
  it("should format BRL positive and negative", () => {
    expect(maskBRL("123456")).toBe("R$ 1.234,56");
    expect(maskBRL("-123456")).toBe("-R$ 1.234,56");
  });

  it("should format USD correctly", () => {
    expect(maskUSD("100050")).toBe("$ 1,000.50");
    expect(maskUSD("-100050")).toBe("-$ 1,000.50");
  });

  it("should return only the sign when input is just a minus", () => {
    expect(maskBRL("-")).toBe("-");
  });
});

describe("Mask Utils - Unmasking", () => {
  it("should clean strings to raw numbers keeping negative sign", () => {
    expect(unmask("(11) 9999-9999")).toBe("1199999999");
    expect(unmask("FIA-6208")).toBe("FIA6208");
  });

  it("should convert currency strings to float numbers", () => {
    expect(unmaskCurrency("R$ 1.200,50")).toBe(1200.5);
    expect(unmaskCurrency("-R$ 50,00")).toBe(-50.0);
    expect(unmaskCurrency("")).toBe(0);
  });
});
