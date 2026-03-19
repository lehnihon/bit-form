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
npm run test:compat
npm run gate:release
```

## Promotion policy (suggested)

1. Keep quality workflow informative first.
2. Stabilize flake/perf thresholds for two weeks.
3. Promote selected checks to required branch protections.

## Rollback

See `quality/release-gates/rollback-plan.md`.
