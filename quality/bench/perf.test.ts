import { describe, expect, it } from "vitest";
import { createBitStore, resolveBitStoreForHooks } from "../../src";

type BigForm = Record<string, string> & {
  email: string;
  username: string;
};

function createBigValues(total: number): BigForm {
  const values: Record<string, string> = {
    email: "",
    username: "",
  };

  for (let index = 0; index < total; index++) {
    values[`field_${index}`] = "";
  }

  return values as BigForm;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx] ?? 0;
}

function withCiHeadroom(baseMs: number): number {
  const factor = process.env.CI ? 1.6 : 1.0;
  return baseMs * factor;
}

describe("quality perf baseline", () => {
  // Budgets recalibrados com medições locais de 20/03/2026:
  // - updates 300 fields: ~19ms
  // - transaction 1000 fields: ~43ms
  // - scoped subscribers: ~9ms
  // - async burst: ~13ms
  // - computed chain: ~51ms
  // - notify fanout: ~16ms
  // Mantemos margem realista para variações de máquina/CI.
  it("updates 300 fields under baseline budget", () => {
    const store = createBitStore<BigForm>({
      initialValues: createBigValues(300),
      validation: {
        resolver: (values) => {
          const errors: Record<string, string | undefined> = {};
          if (!values.email) errors.email = "required";
          return errors;
        },
      },
    });

    const start = performance.now();

    for (let index = 0; index < 300; index++) {
      store.setField(
        `field_${index}` as keyof BigForm & string,
        `value-${index}`,
      );
    }

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(withCiHeadroom(60));
  });

  it("updates 1000 fields in transaction with history under budget", () => {
    const store = createBitStore<BigForm>({
      initialValues: createBigValues(1000),
      history: { enabled: true, limit: 30 },
      validation: {
        resolver: (values) => {
          const errors: Record<string, string | undefined> = {};
          if (!values.email) errors.email = "required";
          return errors;
        },
      },
    });

    const start = performance.now();

    store.transaction(() => {
      for (let index = 0; index < 1000; index++) {
        store.setField(
          `field_${index}` as keyof BigForm & string,
          `value-${index}`,
        );
      }
    });

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(withCiHeadroom(120));
  });

  it("handles 400 scoped subscribers under baseline budget", () => {
    const hooksStore = resolveBitStoreForHooks(
      createBitStore<BigForm>({ initialValues: createBigValues(450) }),
    );

    const unsubs = Array.from({ length: 400 }, (_, index) =>
      hooksStore.subscribePath(
        `field_${index}` as keyof BigForm & string,
        () => {},
      ),
    );

    const start = performance.now();

    for (let index = 0; index < 200; index++) {
      hooksStore.setField("field_200", `value-${index}`);
    }

    const duration = performance.now() - start;
    unsubs.forEach((unsubscribe) => unsubscribe());
    expect(duration).toBeLessThan(withCiHeadroom(30));
  });

  it("handles async validation burst under baseline budget", async () => {
    const store = createBitStore<BigForm>({
      initialValues: createBigValues(220),
      fields: {
        username: {
          validation: {
            asyncValidateDelay: 10,
            asyncValidate: async (value) => {
              await new Promise((resolve) => setTimeout(resolve, 15));
              if (String(value).toLowerCase() === "taken") {
                return "already used";
              }
              return undefined;
            },
          },
        },
      },
      validation: {
        resolver: (values) => {
          const errors: Record<string, string | undefined> = {};
          if (!values.email) errors.email = "required";
          return errors;
        },
      },
    });

    const start = performance.now();

    for (let index = 0; index < 120; index++) {
      store.setField("username", index % 2 === 0 ? "taken" : `user-${index}`);
    }

    await store.validate();

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(withCiHeadroom(40));
  });

  it("computed fanout: 50 computed com dependências em cadeia sob budget", () => {
    type ChainForm = Record<string, number>;

    // Constrói 50 campos base + 50 campos computed em cadeia: c_0 depende de base_0,
    // c_1 depende de c_0, ..., c_49 depende de c_48.
    const initialValues: ChainForm = {};
    const fieldsConfig: Record<string, any> = {};

    for (let i = 0; i < 50; i++) {
      initialValues[`base_${i}`] = i;
      initialValues[`c_${i}`] = 0;
      const dep = i === 0 ? "base_0" : `c_${i - 1}`;
      fieldsConfig[`c_${i}`] = {
        computed: (values: ChainForm) =>
          i === 0
            ? (values[`base_0`] as number) + 1
            : (values[`c_${i - 1}`] as number) + 1,
        computedDependsOn: [dep],
      };
    }

    const store = createBitStore<ChainForm>({
      initialValues,
      fields: fieldsConfig,
    });

    const start = performance.now();

    // Atualiza o campo raiz da cadeia 100 vezes — propaga por todos os 50 computeds.
    for (let i = 0; i < 100; i++) {
      store.setField("base_0", i);
    }

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(withCiHeadroom(140));
  });

  it("subscription notify fanout: 200 subscribers path-scoped sob budget", () => {
    type FanoutForm = Record<string, string> & { trigger: string };

    const initialValues: FanoutForm = { trigger: "" };
    for (let i = 0; i < 200; i++) {
      initialValues[`listener_${i}`] = "";
    }

    const store = createBitStore<FanoutForm>({ initialValues });
    const hooksStore = resolveBitStoreForHooks(
      createBitStore<FanoutForm>({ initialValues }),
    );

    // 200 subscribers diferentes, todos escutando "trigger".
    const unsubs = Array.from({ length: 200 }, () =>
      hooksStore.subscribePath(
        "trigger" as keyof FanoutForm & string,
        () => {},
      ),
    );

    const start = performance.now();

    for (let i = 0; i < 200; i++) {
      hooksStore.setField("trigger", `v${i}`);
    }

    const duration = performance.now() - start;
    unsubs.forEach((u) => u());
    expect(duration).toBeLessThan(withCiHeadroom(60));
  });

  it("p95 setField latency: 1000 updates sob budget", () => {
    type PerfForm = Record<string, string> & { target: string };

    const initialValues: PerfForm = { target: "" };
    for (let i = 0; i < 200; i++) {
      initialValues[`field_${i}`] = "";
    }

    const store = createBitStore<PerfForm>({ initialValues });

    const samples: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const start = performance.now();
      store.setField("target", `v-${i}`);
      samples.push(performance.now() - start);
    }

    const p95 = percentile(samples, 95);
    expect(p95).toBeLessThan(withCiHeadroom(0.8));
  });
});
