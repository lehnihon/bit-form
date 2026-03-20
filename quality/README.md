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
