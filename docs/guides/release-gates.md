# Quality Gates

This guide describes the non-runtime quality blocks used to validate releases without polluting library source code.

## Structure

- `quality/e2e`: Playwright E2E pilot (visual and headless)
- `quality/bench`: performance baseline tests + bit-form vs RHF comparison
- `quality/compat`: real consumer smoke checks via `npm pack`
- `quality/release-gates`: observability and rollback checks

## Commands

```bash
npm run test:e2e:ui
npm run test:e2e
npm run test:bench
npm run test:bench:compare
npm run test:bench:all
npm run test:quality:critical
npm run test:compat
npm run test:release-gates
```

## Promotion policy (suggested)

1. Keep quality workflow informative first.
2. Stabilize flake/perf thresholds for two weeks.
3. Promote selected checks to required branch protections.

## Required gates (major-ready baseline)

For branches targeting major release cutover, the suggested required checks are:

1. `npm run test:unit`
2. `npm run test:frameworks`
3. `npm run test:integration`
4. `npm run test:bench`
5. `npm run test:bench:memory`
6. `npm run test:bundle-size`
7. `vitest run -c quality/vitest.quality.config.ts quality/release-gates/bundle-size-gate.test.ts`
8. `npm run test:observability`
9. `npm run test:compat`

## Coverage matrix

- **Core contracts**: unit + architecture boundaries.
- **Framework adapters**: framework tests + compat smoke.
- **DevTools protocol**: unit tests for type guards and version handling.
- **Artifacts/bundle**: source bundle gate + built `dist` gate.
- **Operational confidence**: observability, rollback plan, and compat smoke.

## DevTools protocol stability

`devtools/protocol` is treated as a stable contract. Changes must:

1. Keep backward-compatibility for one major where possible.
2. Include protocol guard tests.
3. Explicitly document protocol version bump and migration impact.

See `docs/guides/major-v3-migration.md` for migration recipes.

## Rollback

See `quality/release-gates/rollback-plan.md`.
