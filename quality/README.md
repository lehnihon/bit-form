# Quality Gates Workspace

This folder is isolated from library runtime and package exports.

## Blocks

- `e2e/`: Playwright critical-flow tests with visual/headless modes.
- `bench/`: performance baseline tests for large form scenarios.
- `compat/`: real consumer package smoke checks using `npm pack`.
- `release-gates/`: semver/changelog and observability/rollback checks.

## Commands

```bash
npm run test:e2e:ui
npm run test:e2e
npm run test:bench
npm run test:compat
npm run gate:release
```
