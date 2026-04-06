import { describe, expect, it } from "vitest";
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
});
