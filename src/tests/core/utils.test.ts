import { describe, expect, it } from "vitest";
import {
  cleanPrefixedKeys,
  collectDirtyPaths,
  deepClone,
  deepEqual,
  deepMerge,
  extractServerErrors,
  getDeepValue,
  isValidationErrorShape,
  moveKeys,
  setDeepValue,
  shiftKeys,
  swapKeys,
  valueEqual,
} from "../../core/utils";

// -------------------------------------------------------------------
// deepClone
// -------------------------------------------------------------------
describe("utils - deepClone", () => {
  it("clona primitivos", () => {
    expect(deepClone(1)).toBe(1);
    expect(deepClone("abc")).toBe("abc");
    expect(deepClone(null)).toBe(null);
  });

  it("clona objetos aninhados sem referência compartilhada", () => {
    const original = { a: { b: { c: 42 } } };
    const cloned = deepClone(original);
    cloned.a.b.c = 99;
    expect(original.a.b.c).toBe(42);
  });

  it("clona arrays corretamente", () => {
    const original = [1, [2, 3], { x: 4 }];
    const cloned = deepClone(original);
    (cloned[1] as number[])[0] = 99;
    expect((original[1] as number[])[0]).toBe(2);
  });

  it("clona Date sem perder o valor", () => {
    const d = new Date("2025-01-01");
    const cloned = deepClone(d);
    expect(cloned).not.toBe(d);
    expect(cloned.getTime()).toBe(d.getTime());
  });

  it("clona referência circular no fallback sem structuredClone", () => {
    const globalScope = globalThis as {
      structuredClone?: <V>(value: V) => V;
    };
    const originalStructuredClone = globalScope.structuredClone;

    Object.defineProperty(globalScope, "structuredClone", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    try {
      const original: { id: number; self?: unknown } = { id: 1 };
      original.self = original;

      const cloned = deepClone(original) as { id: number; self?: unknown };

      expect(cloned).not.toBe(original);
      expect(cloned.id).toBe(1);
      expect(cloned.self).toBe(cloned);
    } finally {
      Object.defineProperty(globalScope, "structuredClone", {
        value: originalStructuredClone,
        writable: true,
        configurable: true,
      });
    }
  });

  it("faz fallback quando structuredClone lança erro", () => {
    const globalScope = globalThis as {
      structuredClone?: <V>(value: V) => V;
    };
    const originalStructuredClone = globalScope.structuredClone;

    Object.defineProperty(globalScope, "structuredClone", {
      value: () => {
        throw new TypeError("Cannot clone value");
      },
      writable: true,
      configurable: true,
    });

    try {
      const fn = () => "ok";
      const original = { nested: { value: 1 }, fn };

      const cloned = deepClone(original);

      expect(cloned).not.toBe(original);
      expect(cloned.nested).not.toBe(original.nested);
      expect(cloned.nested.value).toBe(1);
      expect(cloned.fn).toBe(fn);
    } finally {
      Object.defineProperty(globalScope, "structuredClone", {
        value: originalStructuredClone,
        writable: true,
        configurable: true,
      });
    }
  });

  it("preserva Map e Set no fallback sem structuredClone", () => {
    const globalScope = globalThis as {
      structuredClone?: <V>(value: V) => V;
    };
    const originalStructuredClone = globalScope.structuredClone;

    Object.defineProperty(globalScope, "structuredClone", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    try {
      const original = {
        metadata: new Map<string, unknown>([
          ["attempts", 2],
          ["nested", { active: true }],
        ]),
        tags: new Set(["core", "persist"]),
      };

      const cloned = deepClone(original);

      expect(cloned.metadata).toBeInstanceOf(Map);
      expect(cloned.metadata).not.toBe(original.metadata);
      expect(cloned.metadata.get("attempts")).toBe(2);
      expect(cloned.metadata.get("nested")).toEqual({ active: true });
      expect(cloned.tags).toBeInstanceOf(Set);
      expect(cloned.tags).not.toBe(original.tags);
      expect([...cloned.tags]).toEqual(["core", "persist"]);
    } finally {
      Object.defineProperty(globalScope, "structuredClone", {
        value: originalStructuredClone,
        writable: true,
        configurable: true,
      });
    }
  });
});

// -------------------------------------------------------------------
// deepEqual / valueEqual
// -------------------------------------------------------------------
describe("utils - deepEqual", () => {
  it("retorna true para primitivos iguais", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("a", "a")).toBe(true);
    expect(deepEqual(null, null)).toBe(true);
  });

  it("retorna false para objetos com valores diferentes", () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it("retorna true para objetos com estrutura idêntica", () => {
    expect(deepEqual({ a: { b: [1, 2] } }, { a: { b: [1, 2] } })).toBe(true);
  });

  it("considera Dates iguais pelo tempo", () => {
    expect(deepEqual(new Date("2025-01-01"), new Date("2025-01-01"))).toBe(
      true,
    );
  });

  it("não lança stack overflow com referências circulares", () => {
    const a: Record<string, unknown> = { x: 1 };
    a.self = a;
    const b: Record<string, unknown> = { x: 1 };
    b.self = b;
    expect(() => deepEqual(a, b)).not.toThrow();
  });

  it("retorna true para grafos cíclicos estruturalmente equivalentes", () => {
    const a: Record<string, unknown> = { profile: { name: "Leo" } };
    a.self = a;

    const b: Record<string, unknown> = { profile: { name: "Leo" } };
    b.self = b;

    expect(deepEqual(a, b)).toBe(true);
  });

  it("retorna false quando um lado tem ciclo e o outro não", () => {
    const a: Record<string, unknown> = { x: 1 };
    a.self = a;
    const b = { x: 1, self: { x: 1, self: null } };
    expect(deepEqual(a, b)).toBe(false);
  });
});

describe("utils - valueEqual", () => {
  it("retorna true para primitivos idênticos com ===", () => {
    expect(valueEqual(42, 42)).toBe(true);
  });

  it("delega para deepEqual para objetos", () => {
    expect(valueEqual({ x: 1 }, { x: 1 })).toBe(true);
    expect(valueEqual({ x: 1 }, { x: 2 })).toBe(false);
  });
});

// -------------------------------------------------------------------
// deepMerge
// -------------------------------------------------------------------
describe("utils - deepMerge", () => {
  it("usa o source quando é primitivo", () => {
    expect(deepMerge({ a: 1 }, 99)).toBe(99);
  });

  it("mescla campos aninhados preservando os não alterados", () => {
    const result = deepMerge({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 99 } });
    expect(result).toEqual({ a: 1, b: { c: 99, d: 3 } });
  });

  it("não compartilha referências com o source original", () => {
    const source = { nested: { x: 1 } };
    const result = deepMerge({}, source);
    (result as any).nested.x = 99;
    expect(source.nested.x).toBe(1);
  });
});

// -------------------------------------------------------------------
// getDeepValue / setDeepValue
// -------------------------------------------------------------------
describe("utils - getDeepValue", () => {
  it("retorna valor em path simples", () => {
    expect(getDeepValue({ a: 1 }, "a")).toBe(1);
  });

  it("retorna valor em path aninhado", () => {
    expect(getDeepValue({ a: { b: { c: 42 } } }, "a.b.c")).toBe(42);
  });

  it("retorna undefined para path inexistente", () => {
    expect(getDeepValue({}, "a.b.c")).toBeUndefined();
  });

  it("retorna o objeto inteiro para path vazio", () => {
    const obj = { x: 1 };
    expect(getDeepValue(obj, "")).toBe(obj);
  });

  it("suporta arrays via índice numérico", () => {
    expect(getDeepValue({ tags: ["a", "b"] }, "tags.1")).toBe("b");
  });
});

describe("utils - setDeepValue", () => {
  it("define valor em path simples", () => {
    const result = setDeepValue({}, "a", 1);
    expect(result.a).toBe(1);
  });

  it("define valor em path aninhado, criando objetos intermediários", () => {
    const result = setDeepValue({}, "a.b.c", 42);
    expect(result.a.b.c).toBe(42);
  });

  it("não muta o objeto original (imutável)", () => {
    const original = { a: { b: 1 } };
    const result = setDeepValue(original, "a.b", 99);
    expect(original.a.b).toBe(1);
    expect(result.a.b).toBe(99);
  });

  it("cria array quando a próxima chave for numérica", () => {
    const result = setDeepValue({}, "items.0", "x");
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items[0]).toBe("x");
  });
});

// -------------------------------------------------------------------
// collectDirtyPaths
// -------------------------------------------------------------------
describe("utils - collectDirtyPaths", () => {
  it("retorna set vazio quando objetos são iguais", () => {
    const paths = collectDirtyPaths({ a: 1 }, { a: 1 });
    expect(paths.size).toBe(0);
  });

  it("detecta campos alterados", () => {
    const paths = collectDirtyPaths({ a: 1, b: 2 }, { a: 1, b: 99 });
    expect(paths.has("b")).toBe(true);
  });

  it("detecta caminhos aninhados", () => {
    const paths = collectDirtyPaths(
      { a: { b: { c: 1 } } },
      { a: { b: { c: 99 } } },
    );
    expect(paths.has("a.b.c")).toBe(true);
  });

  it("não marca dirty para grafos cíclicos equivalentes", () => {
    const current: Record<string, unknown> = { profile: { name: "Leo" } };
    current.self = current;

    const initial: Record<string, unknown> = { profile: { name: "Leo" } };
    initial.self = initial;

    const paths = collectDirtyPaths(current, initial);

    expect(paths.size).toBe(0);
  });
});

// -------------------------------------------------------------------
// shiftKeys / swapKeys / moveKeys
// -------------------------------------------------------------------
describe("utils - shiftKeys", () => {
  const obj = { "items.0.name": "A", "items.1.name": "B", "items.2.name": "C" };

  it("remove o índice e desloca os seguintes para baixo", () => {
    const shifted = shiftKeys(obj, "items", 1);
    expect(shifted["items.0.name"]).toBe("A");
    expect(shifted["items.1.name"]).toBe("C");
    expect(shifted["items.2.name"]).toBeUndefined();
  });
});

describe("utils - swapKeys", () => {
  const obj = { "items.0.name": "A", "items.1.name": "B" };

  it("troca os valores dos dois índices", () => {
    const swapped = swapKeys(obj, "items", 0, 1);
    expect(swapped["items.0.name"]).toBe("B");
    expect(swapped["items.1.name"]).toBe("A");
  });
});

describe("utils - moveKeys", () => {
  const obj = { "items.0": "A", "items.1": "B", "items.2": "C" };

  it("move item do índice 0 para o índice 2", () => {
    const moved = moveKeys(obj, "items", 0, 2);
    expect(moved["items.0"]).toBe("B");
    expect(moved["items.1"]).toBe("C");
    expect(moved["items.2"]).toBe("A");
  });
});

// -------------------------------------------------------------------
// cleanPrefixedKeys
// -------------------------------------------------------------------
describe("utils - cleanPrefixedKeys", () => {
  it("remove chave exata e chaves com préfixo+ponto", () => {
    const obj = { tags: "x", "tags.0": "a", "tags.1": "b", other: "z" };
    const result = cleanPrefixedKeys(obj, "tags");
    expect(result).not.toHaveProperty("tags");
    expect(result).not.toHaveProperty("tags.0");
    expect(result.other).toBe("z");
  });
});

// -------------------------------------------------------------------
// isValidationErrorShape / extractServerErrors
// -------------------------------------------------------------------
describe("utils - isValidationErrorShape", () => {
  it("reconhece shape { field: message }", () => {
    expect(isValidationErrorShape({ email: "Invalid" })).toBe(true);
  });

  it("reconhece shape { errors: { field: [message] } }", () => {
    expect(isValidationErrorShape({ errors: { email: ["Invalid"] } })).toBe(
      true,
    );
  });

  it("rejeita arrays, null e primitivos", () => {
    expect(isValidationErrorShape(null)).toBe(false);
    expect(isValidationErrorShape([])).toBe(false);
    expect(isValidationErrorShape("error")).toBe(false);
  });

  it("rejeita Error e objetos vazios", () => {
    expect(isValidationErrorShape(new Error("boom"))).toBe(false);
    expect(isValidationErrorShape({})).toBe(false);
    expect(isValidationErrorShape({ errors: {} })).toBe(false);
  });

  it("rejeita objetos com valores não-string", () => {
    expect(isValidationErrorShape({ field: 42 })).toBe(false);
  });
});

describe("utils - extractServerErrors", () => {
  it("retorna erros diretos do shape plano", () => {
    const result = extractServerErrors({ email: "Invalid" });
    expect(result).toEqual({ email: "Invalid" });
  });

  it("extrai de { errors: { ... } }", () => {
    const result = extractServerErrors({ errors: { name: ["Required"] } });
    expect(result).toEqual({ name: ["Required"] });
  });

  it("retorna objeto vazio para input inválido", () => {
    expect(extractServerErrors("bad")).toEqual({});
    expect(extractServerErrors(null)).toEqual({});
  });
});
