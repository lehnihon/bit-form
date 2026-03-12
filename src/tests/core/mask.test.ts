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
  maskCreditCard,
  createCreditCardMask,
  maskIBAN,
  createDateMask,
} from "../../core/mask";

describe("Mask Utils - Patterns", () => {
  it("should respect standard tokens (#, A, X)", () => {
    const mask = createPatternMask("AAA-####-X");
    expect(mask.format("abc1234z")).toBe("abc-1234-z");
    expect(mask.format("123-abc")).toBe("");
  });

  it("should handle fixed characters correctly", () => {
    const mask = createPatternMask("+55 (##) #####-####");
    expect(mask.format("11988887777")).toBe("+55 (11) 98888-7777");
  });

  it("should handle new international tokens (H, U, L)", () => {
    const hexMask = createPatternMask("HHHHHH");
    expect(hexMask.format("FF00GG")).toBe("FF00");

    const upperMask = createPatternMask("UUU");
    expect(upperMask.format("abc")).toBe("ABC");
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
    expect(maskEUR.format("5000")).toBe("50,00 €");
  });

  it("should handle allowNegative option", () => {
    const positiveOnly = createCurrencyMask({
      thousand: ".",
      decimal: ",",
      allowNegative: false,
    });

    expect(positiveOnly.format("-100")).toBe("1,00");
    expect(positiveOnly.parse("-100")).toBe(1);
  });

  it("should parse currency strings back to float numbers", () => {
    expect(maskBRL.parse("R$ 1.200,50")).toBe(1200.5);
    expect(maskUSD.parse("-$ 1,000.50")).toBe(-1000.5);
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
    expect(unmask("123.456", ".")).toBe("123.456");
    expect(unmask("ABC-123", "-")).toBe("ABC-123");
    expect(unmask("123.456")).toBe("123456");
  });

  it("should convert currency strings to float numbers directly", () => {
    expect(unmaskCurrency("R$ 1.200,50")).toBe(1200.5);
    expect(unmaskCurrency("-R$ 50,00")).toBe(-50.0);
    expect(unmaskCurrency("")).toBe(0);
  });
});

describe("Mask Utils - Dynamic Patterns", () => {
  it("should switch patterns dynamically based on input length", () => {
    const dynamicPhoneMask = createPatternMask([
      "(##) ####-####",
      "(##) #####-####",
    ]);

    // Testa o tamanho do telefone fixo
    expect(dynamicPhoneMask.format("1144445555")).toBe("(11) 4444-5555");

    // Testa o tamanho do telemóvel (adicionando o 9)
    expect(dynamicPhoneMask.format("11944445555")).toBe("(11) 94444-5555");
  });
});

describe("Mask Utils - Dynamic Patterns (Array)", () => {
  it("deve alternar entre padrões dependendo do tamanho do input (ex: Telefone BR)", () => {
    const dynamicPhone = createPatternMask([
      "(##) ####-####", // 10 dígitos (Fixo)
      "(##) #####-####", // 11 dígitos (Telemóvel)
    ]);

    // Fixo
    expect(dynamicPhone.format("1144445555")).toBe("(11) 4444-5555");
    expect(dynamicPhone.parse("(11) 4444-5555")).toBe("1144445555");

    // Telemóvel (1 dígito a mais)
    expect(dynamicPhone.format("11944445555")).toBe("(11) 94444-5555");
    expect(dynamicPhone.parse("(11) 94444-5555")).toBe("11944445555");
  });
});

describe("Mask Utils - Advanced Unmasking Options", () => {
  it("deve preservar caracteres definidos em allowChars no parse", () => {
    const intlPhone = createPatternMask("+## (##) #####-####", {
      allowChars: "+",
    });

    expect(intlPhone.format("+5511999999999")).toBe("+55 (11) 99999-9999");
    // O unmasking padrão do Bit-form removeria o '+', mas com a opção ele deve ser mantido
    expect(intlPhone.parse("+55 (11) 99999-9999")).toBe("+5511999999999");
  });

  it("deve usar a função customParse se fornecida (ex: Data BR para ISO)", () => {
    const smartDate = createPatternMask("##/##/####", {
      customParse: (val) => {
        const parts = val.split("/");
        if (parts.length === 3) {
          // Inverte para o formato de banco de dados (YYYY-MM-DD)
          return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return val.replace(/\D/g, "");
      },
    });

    expect(smartDate.format("25122026")).toBe("25/12/2026");

    // O parse deve ignorar o comportamento padrão e acionar o customParse
    expect(smartDate.parse("25/12/2026")).toBe("2026-12-25");
  });
});

describe("Mask Utils - Smart Credit Card Detection", () => {
  it("deve aplicar formato padrão (16 dígitos) para Visa e Mastercard", () => {
    const ccMask = maskCreditCard; // Usando o preset atualizado

    // Visa começa com 4
    expect(ccMask.format("4111222233334444")).toBe("4111 2222 3333 4444");

    // Mastercard começa com 5
    expect(ccMask.format("5555444433332222")).toBe("5555 4444 3333 2222");
  });

  it("deve detectar American Express (Amex) e aplicar formato de 15 dígitos", () => {
    const ccMask = maskCreditCard;

    // Amex começa com 34 ou 37
    expect(ccMask.format("341234567890123")).toBe("3412 345678 90123");
    expect(ccMask.format("371234567890123")).toBe("3712 345678 90123");
  });

  it("deve detectar Diners Club e aplicar formato de 14 dígitos", () => {
    const ccMask = maskCreditCard;

    // Diners começa com 300 a 305, 36 ou 38
    expect(ccMask.format("36123456789012")).toBe("3612 345678 9012");
  });

  it("deve respeitar a opção saveRaw ao fazer o parse", () => {
    // Usando o criador diretamente com opções
    const rawCcMask = createCreditCardMask({ saveRaw: true });

    // O parse deve retornar a string formatada em vez do número colado
    expect(rawCcMask.parse("341234567890123")).toBe("3412 345678 90123");
  });
});

describe("Mask Utils - Guide/Placeholder", () => {
  it("deve preencher o restante da máscara com o placeholder se guide for true", () => {
    const cpfGuide = createPatternMask("###.###.###-##", { guide: true });

    // Campo vazio mostra o guide completo
    expect(cpfGuide.format("")).toBe("___.___.___-__");

    // Digitação parcial preenche o resto
    expect(cpfGuide.format("12345")).toBe("123.45_.___-__");
  });

  it("deve permitir mudar o caractere do placeholder", () => {
    const dateGuide = createPatternMask("##/##/####", {
      guide: true,
      placeholderChar: "X",
    });

    expect(dateGuide.format("12")).toBe("12/XX/XXXX");
  });

  it("não deve salvar os placeholders no parse mesmo com saveRaw = true", () => {
    const rawGuide = createPatternMask("###.###", {
      guide: true,
      saveRaw: true,
    });

    // Se o user digitou apenas "12", a store deve receber "123." e não "123.___"
    expect(rawGuide.parse("123.___")).toBe("123.");
  });
});

describe("Mask Utils - International & Smart Dates", () => {
  it("deve limitar o dia a 31 e o mês a 12 na máscara de data", () => {
    const dateMask = createDateMask({ format: "DD/MM/YYYY" });

    // Tenta digitar 35 no dia -> vira 31 (sem barra final)
    expect(dateMask.format("35")).toBe("31");

    // Tenta digitar 12 no dia e 15 no mês -> vira 12/12 (sem barra final)
    expect(dateMask.format("1215")).toBe("12/12");

    // Tenta digitar 00 no dia -> vira 01 (como preencheu tudo, tem as barras normais do meio)
    expect(dateMask.format("00102025")).toBe("01/10/2025");
  });

  it("deve limitar corretamente no formato ISO (YYYY-MM-DD)", () => {
    const isoMask = createDateMask({ format: "YYYY-MM-DD" });

    // Ano 2025, Mês 13 (vira 12), Dia 35 (vira 31)
    expect(isoMask.format("20251335")).toBe("2025-12-31");
  });

  it("deve formatar o IBAN colocando as letras em maiúsculas e espaçando", () => {
    // Usamos diretamente o preset do IBAN
    const ptIban = "pt50123456789012345678901";
    expect(maskIBAN.format(ptIban)).toBe("PT50 1234 5678 9012 3456 7890 1");
  });
});
