import { describe, expect, it, vi } from "vitest";
import {
  BitComputedManager,
  type BitComputedEntry,
} from "../../core/store/managers/core/computed-manager";

describe("BitComputedManager", () => {
  it("should run only affected computed entries for explicit changed paths", () => {
    const entries: BitComputedEntry<any>[] = [
      {
        path: "a",
        dependsOn: ["x"],
        compute: (values) => values.x * 2,
      },
      {
        path: "b",
        dependsOn: ["a"],
        compute: (values) => values.a + 1,
      },
    ];

    const manager = new BitComputedManager(() => entries);

    const unchanged = manager.apply({ x: 1, y: 2, a: 2, b: 3 }, ["y"]);
    expect(unchanged).toEqual({ x: 1, y: 2, a: 2, b: 3 });

    const changed = manager.apply({ x: 3, y: 2, a: 0, b: 0 }, ["x"]);
    expect(changed.a).toBe(6);
    expect(changed.b).toBe(7);
  });

  it("should throw for cyclic computed dependencies", () => {
    const entries: BitComputedEntry<any>[] = [
      {
        path: "a",
        dependsOn: ["b"],
        compute: (values) => values.b,
      },
      {
        path: "b",
        dependsOn: ["a"],
        compute: (values) => values.a,
      },
    ];

    const manager = new BitComputedManager(() => entries);

    expect(() => manager.apply({ a: 1, b: 2 }, ["a"])).toThrow(
      "cyclic computed dependencies detected",
    );
  });

  // --- Stress & edge-case tests ---

  it("fanout: 30 computeds dependendo da mesma source são todos recalculados", () => {
    const entries: BitComputedEntry<any>[] = Array.from(
      { length: 30 },
      (_, i) => ({
        path: `out_${i}`,
        dependsOn: ["source"],
        compute: (values: any) => values.source + i,
      }),
    );

    const manager = new BitComputedManager(() => entries);

    const initial: Record<string, number> = { source: 0 };
    for (let i = 0; i < 30; i++) initial[`out_${i}`] = 0;

    const result = manager.apply(initial, ["source"]);

    for (let i = 0; i < 30; i++) {
      expect(result[`out_${i}`]).toBe(i);
    }
  });

  it("cadeia profunda: propagação através de 10 nós sequenciais", () => {
    // c_0 = source+1, c_1 = c_0+1, ..., c_9 = c_8+1
    const entries: BitComputedEntry<any>[] = Array.from(
      { length: 10 },
      (_, i) => ({
        path: `c_${i}`,
        dependsOn: [i === 0 ? "source" : `c_${i - 1}`],
        compute: (values: any) =>
          i === 0 ? values.source + 1 : values[`c_${i - 1}`] + 1,
      }),
    );

    const manager = new BitComputedManager(() => entries);

    const initial: Record<string, number> = { source: 0 };
    for (let i = 0; i < 10; i++) initial[`c_${i}`] = 0;

    const result = manager.apply(initial, ["source"]);

    // source=0 → c_0=1, c_1=2, ..., c_9=10
    for (let i = 0; i < 10; i++) {
      expect(result[`c_${i}`]).toBe(i + 1);
    }
  });

  it("childDepsIndex: computed com dep 'user.name' é acionado quando 'user' muda", () => {
    // Verifica que o novo índice de prefixo-filho captura dependências aninhadas.
    const entries: BitComputedEntry<any>[] = [
      {
        path: "label",
        dependsOn: ["user.name"],
        compute: (values: any) => `Olá, ${values.user.name}`,
      },
    ];

    const manager = new BitComputedManager(() => entries);

    const _initial = { user: { name: "Leo" }, label: "" };
    // "user" é pai de "user.name" — deve propagar via childDepsIndex
    const result = manager.apply({ user: { name: "Ana" }, label: "" }, [
      "user",
    ]);

    expect(result.label).toBe("Olá, Ana");
  });

  it("invalidateReverseDeps é chamado quando deps de rastreamento mudam", () => {
    // Garante que após invalidação o cache é reconstruído corretamente.
    const entries: BitComputedEntry<any>[] = [
      {
        path: "out",
        dependsOn: ["a"],
        compute: (values: any) => values.a * 10,
      },
    ];

    const manager = new BitComputedManager(() => entries);

    manager.apply({ a: 1, out: 0 }, ["a"]);
    // Invalida manualmente (simula registro de novo campo).
    manager.invalidateReverseDeps();
    // Após invalidação deve reconstruir e propagar corretamente.
    const result = manager.apply({ a: 5, out: 0 }, ["a"]);
    expect(result.out).toBe(50);
  });

  it("não reescreve computed quando o próximo valor cíclico é estruturalmente equivalente", () => {
    const entries: BitComputedEntry<any>[] = [
      {
        path: "computed",
        dependsOn: ["source"],
        compute: () => {
          const next: Record<string, unknown> = { label: "stable" };
          next.self = next;
          return next;
        },
      },
    ];

    const manager = new BitComputedManager(() => entries);
    const computed: Record<string, unknown> = { label: "stable" };
    computed.self = computed;
    const values = { source: 1, computed };

    const result = manager.apply(values, ["source"]);

    expect(result).toBe(values);
  });

  it("reusa ordenação quando configuração não muda e invalida ao mudar entries", () => {
    const entriesA: BitComputedEntry<any>[] = [
      {
        path: "sum",
        dependsOn: ["x", "y"],
        compute: (values) => values.x + values.y,
      },
      {
        path: "double",
        dependsOn: ["sum"],
        compute: (values) => values.sum * 2,
      },
    ];

    let currentEntries = entriesA;
    const manager = new BitComputedManager(() => currentEntries);

    const first = manager.apply({ x: 1, y: 2, sum: 0, double: 0 }, ["x"]);
    expect(first.double).toBe(6);

    const second = manager.apply({ x: 2, y: 3, sum: 0, double: 0 }, ["x"]);
    expect(second.double).toBe(10);

    currentEntries = [
      ...entriesA,
      {
        path: "triple",
        dependsOn: ["double"],
        compute: (values: any) => values.double * 3,
      },
    ];

    const third = manager.apply({ x: 2, y: 3, sum: 0, double: 0, triple: 0 }, [
      "x",
    ]);
    expect(third.triple).toBe(30);
  });

  // ── Regressão BUG-3 ──────────────────────────────────────────────────────
  it("BUG-3: compute() que lança não deve propagar exceção; onError é chamado e campo mantém valor anterior", () => {
    const onError = vi.fn();
    const entries: BitComputedEntry<any>[] = [
      {
        path: "safe",
        dependsOn: ["x"],
        compute: (values) => values.x * 10,
      },
      {
        path: "throwing",
        dependsOn: ["x"],
        compute: () => {
          throw new Error("compute exploded");
        },
      },
      {
        path: "afterThrowing",
        dependsOn: ["throwing"],
        compute: (values) => String(values.throwing ?? "fallback"),
      },
    ];

    const manager = new BitComputedManager(() => entries, onError);

    const initial = { x: 1, safe: 0, throwing: "prior", afterThrowing: "" };

    let result: any;
    expect(() => {
      result = manager.apply(initial, ["x"]);
    }).not.toThrow();

    // onError deve ter sido chamado com o erro e o path
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "compute exploded" }),
      "throwing",
    );

    // campo "safe" deve ter executado normalmente
    expect(result.safe).toBe(10);

    // campo "throwing" deve manter o valor anterior (skip)
    expect(result.throwing).toBe("prior");
  });

  it("BUG-3: sem onError registrado, compute() que lança ainda não propaga — continua silenciosamente", () => {
    const entries: BitComputedEntry<any>[] = [
      {
        path: "boom",
        dependsOn: ["x"],
        compute: () => {
          throw new RangeError("boom");
        },
      },
    ];

    const manager = new BitComputedManager(() => entries); // sem onError

    expect(() => manager.apply({ x: 1, boom: 0 }, ["x"])).not.toThrow();
  });

  // ── Regressão BUG-computed-skip-deps ─────────────────────────────────────
  it("BUG-computed-skip-deps: downstream de upstream falho não deve executar na mesma rodada", () => {
    const onError = vi.fn();
    const downstreamSpy = vi.fn((values: any) => `${values.a}:derived`);

    const entries: BitComputedEntry<any>[] = [
      {
        path: "a",
        dependsOn: ["x"],
        compute: () => {
          throw new Error("upstream exploded");
        },
      },
      {
        path: "b",
        dependsOn: ["a"],
        compute: downstreamSpy,
      },
    ];

    const manager = new BitComputedManager(() => entries, onError);
    const initial = { x: 1, a: "old-a", b: "old-b" };

    const result = manager.apply(initial, ["x"]);

    // upstream falhou → onError chamado
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "upstream exploded" }),
      "a",
    );

    // downstream NÃO deve ter sido chamado
    expect(downstreamSpy).not.toHaveBeenCalled();

    // valores antigos preservados
    expect(result.a).toBe("old-a");
    expect(result.b).toBe("old-b");
  });

  it("BUG-computed-skip-deps: computed sem dependência de falho ainda executa normalmente", () => {
    const onError = vi.fn();
    const entries: BitComputedEntry<any>[] = [
      {
        path: "a",
        dependsOn: ["x"],
        compute: () => {
          throw new Error("explode");
        },
      },
      {
        path: "independent",
        dependsOn: ["x"],
        compute: (values: any) => values.x * 99,
      },
    ];

    const manager = new BitComputedManager(() => entries, onError);
    const result = manager.apply({ x: 2, a: "old", independent: 0 }, ["x"]);

    // "independent" não depende de "a" — deve executar
    expect(result.independent).toBe(198);
    // "a" preserva valor antigo
    expect(result.a).toBe("old");
  });

  describe("Computed Stability - Integration Performance", () => {
    it("should handle circular field dependencies without O(n²) explosion", async () => {
      const { createBitStore } = await import("../../core");
      const store = (createBitStore as any)({
        initialValues: { fieldA: 5, fieldB: 0 },
        fields: {
          fieldA: {
            conditional: {
              dependsOn: ["fieldB"],
              showIf: (v: any) => v.fieldB > 0,
            },
          },
          fieldB: {
            conditional: {
              dependsOn: ["fieldA"],
              showIf: (v: any) => v.fieldA > 0,
              requiredIf: (v: any) => v.fieldA > 3,
            },
          },
        },
      });

      const start = performance.now();
      store.write.setField("fieldA", 10);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it("should not cause UI freeze with highly interdependent fields", async () => {
      const { createBitStore } = await import("../../core");
      const fields: Record<string, any> = {};

      for (let i = 0; i < 30; i++) {
        const dependsOn = i > 0 ? [`field${i - 1}`] : [];
        fields[`field${i}`] = {
          conditional: {
            dependsOn,
            showIf: (v: any) => {
              if (dependsOn.length === 0) return true;
              const prevField = dependsOn[0];
              return (
                (v as any)[prevField] !== undefined && (v as any)[prevField] > 0
              );
            },
          },
        };
      }

      const initialValues: Record<string, number> = {};
      for (let i = 0; i < 30; i++) {
        initialValues[`field${i}`] = i;
      }

      const store = (createBitStore as any)({
        initialValues,
        fields,
      });

      const start = performance.now();
      store.write.setField("field0", 100);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
