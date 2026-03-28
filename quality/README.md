# Quality Gates Workspace

This folder is isolated from library runtime and package exports.

## Blocks

- `bench/`: performance baseline tests + framework comparison (bit-form vs RHF/Formik/TanStack).
- `compat/`: real consumer package smoke checks using `npm pack`.
- `release-gates/`: bundle/observability and rollback checks.

## Commands

```bash
# Benchmarks internos
npm run test:bench
npm run test:bench:memory
npm run test:bench:all

# Benchmark comparativo (Vitest, Node.js)
npm run test:bench:compare

# Release gates
npm run test:compat
npm run test:release-gates
```

## Metodologia do comparativo realista

As comparações entre bit-form, React Hook Form, Formik e TanStack Form seguem:

### Semântica equalizada

- **Mesmo trigger de validação:** todas as libs disparam `validate` uma vez no final do ciclo, sem validação por campo durante o burst de updates.
- **TanStack Form:** usa `onSubmit` validator (equivalente ao `validate` manual do bit-form).
- **Formik:** `validateOnBlur: false, validateOnChange: false` para paridade.
- **RHF:** `mode: "onSubmit", reValidateMode: "onSubmit"` para paridade.
- **Cleanup:** todas fazem `reset()` ao final de cada iteração.

### Estabilização de commit React

- Cada amostra aplica `settleReactCommit()` antes e depois do bloco medido.
- `settleReactCommit()` aguarda microtasks + macrotask + `act(async () => {})` para garantir que o React flushou commits antes do próximo ciclo.

### Carga e amostras

- Cenário bulk: 600 campos (padrão) — configurável via `BENCH_COMPARE_BULK_FIELDS`.
- Cenário async burst: 240 iterações (padrão) — configurável via `BENCH_COMPARE_ASYNC_ITERATIONS`.
- 8 warmups + 40 amostras (padrão) — configurável via `BENCH_COMPARE_WARMUPS` / `BENCH_COMPARE_SAMPLES`.
- Timeout por teste: 300 s (padrão) — configurável via `BENCH_COMPARE_TEST_TIMEOUT_MS`.

## Benchmark calibration (perf.test.ts)

- Budgets baseados em medições reais (macOS M-series, Vitest jsdom).
- Baseline atual:
  - update 300 fields: ~19ms
  - transaction 1000 fields: ~43ms
  - subscribers scoped: ~9ms
  - async burst: ~13ms
  - computed chain: ~51ms
  - notify fanout: ~16ms
- Em CI é aplicada folga adicional para reduzir flakiness entre máquinas.
- Recalibre budgets apenas após mudança arquitetural relevante e com nova medição.

## Baseline comparativo (Node, medição local)

| Cenário             | bit-form | RHF     | Formik  | TanStack |
| ------------------- | -------- | ------- | ------- | -------- |
| bulk 600 campos     | ~5.8 ms  | ~556 ms | ~191 ms | ~1553 ms |
| async burst 240 it. | ~4.6 ms  | ~65 ms  | ~22 ms  | ~13.5 ms |

bit-form/RHF ratio bulk: **~0.02x** (50x mais rápido em batch de atualizações)
bit-form/TanStack ratio async: **~0.34x** (~2.9x mais rápido após a mudança de trigger default + pipeline async)

### Observação importante sobre a mudança arquitetural

- `asyncValidate` agora roda por padrão em `blur` e também em `validate()`/submit.
- Se o benchmark ou a UX precisarem de checagem enquanto digita, use `asyncValidateOn: "change"` explicitamente.
- Isso reduz agendamento desnecessário, churn de `isValidating` e custo de bursts assíncronos sem remover o caminho opt-in para validação live.
