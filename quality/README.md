# Quality Gates Workspace

This folder is isolated from library runtime and package exports.

## Blocks

- `e2e/`: Playwright critical-flow tests (fluxo real + benchmark browser).
- `bench/`: performance baseline tests + framework comparison (bit-form vs RHF/Formik/TanStack).
- `compat/`: real consumer package smoke checks using `npm pack`.
- `release-gates/`: bundle/observability and rollback checks.

## Commands

```bash
# Testes E2E
npm run test:e2e
npm run test:e2e:ui

# Benchmarks internos
npm run test:bench
npm run test:bench:memory
npm run test:bench:all

# Benchmark comparativo (Vitest, Node.js)
npm run test:bench:compare

# Benchmark comparativo em browser real (Playwright + Chromium, modo dev)
npm run test:bench:compare:browser

# Benchmark comparativo em browser real (Playwright + Chromium, build preview)
npm run test:bench:compare:browser:prod

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

### Modo produção

- `npm run test:bench:compare:browser:prod` constrói o fixture com `vite build` antes do Playwright (sem source maps, minificado, React em modo production).

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
| bulk 600 campos     | ~12 ms   | ~505 ms | ~250 ms | ~1980 ms |
| async burst 240 it. | ~15 ms   | ~68 ms  | ~23 ms  | ~14 ms   |

bit-form/RHF ratio bulk: **~0.02x** (50x mais rápido em batch de atualizações)
bit-form/TanStack ratio async: **~1.1x** (equivalente — mesma ordem de grandeza)
