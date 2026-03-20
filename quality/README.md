# Quality Gates Workspace

This folder is isolated from library runtime and package exports.

## Blocks

- `e2e/`: Playwright critical-flow tests with visual/headless modes.
- `bench/`: performance baseline tests + framework comparison (bit-form vs RHF).
- `compat/`: real consumer package smoke checks using `npm pack`.
- `release-gates/`: bundle/observability and rollback checks.

## Commands

```bash
npm run test:e2e:ui
npm run test:e2e
npm run test:bench
npm run test:bench:memory
npm run test:bench:compare
npm run test:bench:all
npm run test:compat
npm run test:release-gates
```

## Benchmark calibration

- Benchmarks de `quality/bench/perf.test.ts` usam budgets baseados em medições reais.
- Baseline atual (20/03/2026):
	- update 300 fields: ~19ms
	- transaction 1000 fields: ~43ms
	- subscribers scoped: ~9ms
	- async burst: ~13ms
	- computed chain: ~51ms
	- notify fanout: ~16ms
- Em CI é aplicada folga adicional para reduzir flakiness entre máquinas.
- Recalibre budgets apenas após mudança arquitetural relevante e com nova medição.
