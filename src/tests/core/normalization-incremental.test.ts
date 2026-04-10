import { describe, expect, it, vi } from "vitest";
import { createBitStore as createBitStoreRuntime } from "../../core";

const createBitStore = ((config?: any) => createBitStoreRuntime(config)) as any;

/**
 * Testes de normalização incremental path-driven.
 *
 * Verificam que apenas os normalizers cujos `normalizeDependsOn`
 * são impactados pelo `changedPaths` do batch são executados —
 * reduzindo O(N-campos) para O(normalizers-afetados).
 */
describe("Incremental Normalization (normalizeDependsOn)", () => {
  it("executa somente o normalizer do campo cujo dependsOn foi impactado", () => {
    const normalizeName = vi.fn((v: unknown) => String(v).trim());
    const normalizeEmail = vi.fn((v: unknown) => String(v).toLowerCase());

    const store = createBitStore({
      initialValues: { name: "", email: "", phone: "" },
      fields: {
        name: {
          // dependsOn default → ["name"]
          normalize: normalizeName,
        },
        email: {
          // executa apenas quando 'phone' muda
          normalize: normalizeEmail,
          normalizeDependsOn: ["phone"],
        },
      },
    });

    // Limpa contagens do batch inicial (todos os normalizers rodam uma vez)
    normalizeName.mockClear();
    normalizeEmail.mockClear();

    // Alterar "name" → normalizeName deve rodar, normalizeEmail NÃO
    store.write.setField("name", "  Leandro  ");

    expect(normalizeName).toHaveBeenCalledTimes(1);
    expect(normalizeEmail).toHaveBeenCalledTimes(0);

    normalizeName.mockClear();
    normalizeEmail.mockClear();

    // Alterar "phone" → normalizeEmail deve rodar (é sua dependência), normalizeName NÃO
    store.write.setField("phone", "1234");

    expect(normalizeEmail).toHaveBeenCalledTimes(1);
    expect(normalizeName).toHaveBeenCalledTimes(0);
  });

  it("aplica o valor normalizado corretamente no state após setField", () => {
    const store = createBitStore({
      initialValues: { name: "", code: "" },
      fields: {
        name: {
          normalize: (v) => String(v).trim(),
        },
        code: {
          normalize: (_v, values: any) =>
            String(values.name).length > 0 ? "populated" : "empty",
          normalizeDependsOn: ["name"],
        },
      },
    });

    store.write.setField("name", "  Leandro  ");

    // name é trimado
    expect(store.read.getState().values.name).toBe("Leandro");
    // code normalizer executa porque depende de "name"
    expect(store.read.getState().values.code).toBe("populated");
  });

  it("não re-executa normalizer cujo dependsOn não foi impactado em setValues parcial", () => {
    const normalizeCode = vi.fn((_v: unknown) => "normalized");

    const store = createBitStore({
      initialValues: { name: "", email: "", code: "" },
      fields: {
        code: {
          normalize: normalizeCode,
          normalizeDependsOn: ["name"],
        },
      },
    });

    normalizeCode.mockClear();

    // Atualiza apenas "email" — não impacta "name", então normalizeCode não deve rodar
    store.write.setValues({ email: "test@test.com" }, { partial: true });

    expect(normalizeCode).toHaveBeenCalledTimes(0);
  });

  it("executa todos os normalizers em reset (wildcard = full batch)", () => {
    const normalizeName = vi.fn((v: unknown) => String(v).trim());
    const normalizeEmail = vi.fn((v: unknown) => String(v).toLowerCase());

    const store = createBitStore({
      initialValues: { name: "  old  ", email: "OLD@EMAIL.COM" },
      fields: {
        name: { normalize: normalizeName },
        email: {
          normalize: normalizeEmail,
          normalizeDependsOn: ["name"],
        },
      },
    });

    normalizeName.mockClear();
    normalizeEmail.mockClear();

    // Reset → changedPaths = "*" → todos os normalizers rodam
    store.write.reset();

    expect(normalizeName).toHaveBeenCalled();
    expect(normalizeEmail).toHaveBeenCalled();
  });

  it("campo com normalizeDependsOn em path pai impacta filhos (prefix match)", () => {
    const normalizeChild = vi.fn((v: unknown) => String(v).toUpperCase());

    const store = createBitStore({
      initialValues: { address: { street: "", city: "" }, tag: "" },
      fields: {
        "address.city": {
          normalize: normalizeChild,
          // depende do prefixo "address" — qualquer sub-campo de address o dispara
          normalizeDependsOn: ["address"],
        },
      },
    });

    normalizeChild.mockClear();

    // Alterar "address.street" deve impactar "address" como prefixo
    store.write.setField("address.street", "Rua X");

    expect(normalizeChild).toHaveBeenCalledTimes(1);

    normalizeChild.mockClear();

    // Alterar "tag" NÃO deve disparar
    store.write.setField("tag", "xyz");

    expect(normalizeChild).toHaveBeenCalledTimes(0);
  });

  it("aplica normalizers antes de computeds no estado inicial", () => {
    const store = createBitStore({
      initialValues: { name: "  Leandro  ", greeting: "" },
      fields: {
        name: {
          normalize: (value) => String(value).trim(),
        },
        greeting: {
          computed: (values) => `Olá, ${values.name}`,
          computedDependsOn: ["name"],
        },
      },
    });

    expect(store.read.getState().values.name).toBe("Leandro");
    expect(store.read.getState().values.greeting).toBe("Olá, Leandro");
  });

  it("recalcula computeds quando normalizer altera um path dependido", () => {
    const store = createBitStore({
      initialValues: { name: "", greeting: "" },
      fields: {
        name: {
          normalize: (value) => String(value).trim(),
        },
        greeting: {
          computed: (values) => `Olá, ${values.name}`,
          computedDependsOn: ["name"],
        },
      },
    });

    store.write.setField("name", "  Ana  ");

    expect(store.read.getState().values.name).toBe("Ana");
    expect(store.read.getState().values.greeting).toBe("Olá, Ana");
  });

  it("normalizer downstream lê o valor já normalizado do upstream na mesma rodada", () => {
    const store = createBitStore({
      initialValues: { firstName: "", fullName: "" },
      fields: {
        firstName: {
          normalize: (value) => String(value).trim(),
        },
        fullName: {
          normalize: (_value, values: any) => String(values.firstName),
          normalizeDependsOn: ["firstName"],
        },
      },
    });

    store.write.setField("firstName", "  Ana  ");

    expect(store.read.getState().values).toEqual({
      firstName: "Ana",
      fullName: "Ana",
    });
  });

  it("ordena normalizers por dependência em registro dinâmico fora de ordem", () => {
    const store = createBitStore({
      initialValues: { firstName: "", fullName: "" },
    });

    store.feature.registerField("fullName", {
      normalize: (_value, values: any) => String(values.firstName),
      normalizeDependsOn: ["firstName"],
    });

    store.feature.registerField("firstName", {
      normalize: (value) => String(value).trim(),
    });

    store.write.setField("firstName", "  Ana  ");

    expect(store.read.getState().values).toEqual({
      firstName: "Ana",
      fullName: "Ana",
    });
  });

  it("reporta ciclo em normalizeDependsOn e evita rodada de normalização indefinida", () => {
    const onUnhandledError = vi.fn();

    const store = createBitStore({
      initialValues: { a: "init-a", b: "init-b", name: "  Ana  " },
      onUnhandledError,
      fields: {
        a: {
          normalize: (_value, values: any) => `A:${values.b}`,
          normalizeDependsOn: ["b"],
        },
        b: {
          normalize: (_value, values: any) => `B:${values.a}`,
          normalizeDependsOn: ["a"],
        },
        name: {
          normalize: (value) => String(value).trim(),
        },
      },
    });

    onUnhandledError.mockClear();

    store.write.reset();

    expect(onUnhandledError).toHaveBeenCalled();
    expect(
      onUnhandledError.mock.calls.some(
        ([error, source]) =>
          source === "derivation" &&
          error instanceof Error &&
          error.message.includes("cyclic normalizer dependencies detected"),
      ),
    ).toBe(true);

    // Entradas cíclicas não devem ser executadas.
    expect(store.read.getState().values.a).toBe("init-a");
    // Entradas acíclicas continuam executando na mesma rodada.
    expect(store.read.getState().values.name).toBe("Ana");
  });
});
