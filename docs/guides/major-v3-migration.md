# Major v3 Migration Guide

This guide tracks migration recipes for breaking changes accepted in the architecture redesign.

## Scope of this major

- capability-oriented public typing exposure (`BitStoreQueryApi`, `BitStoreObserveApi`, `BitStoreWriteApi`, feature APIs)
- stable and versioned DevTools protocol handshake (`HELLO` + `protocolVersion`)
- expanded release gates including `devtools` and `cli` bundle budgets

## Breaking-change policy

- Breaking changes are allowed only in major release windows.
- Every break must include:
  1. migration recipe
  2. rollback notes
  3. gate updates

## Recipe 1: capability-oriented typing

### Before

Consumers often depended only on `BitStoreApi`/`BitStoreHooksApi`.

### After

Prefer capability-specific contracts when composing abstractions:

- `BitStoreQueryApi`
- `BitStoreObserveApi`
- `BitStoreWriteApi`
- `BitStoreFeatureApi`
- `BitStorePersistFeatureApi`
- `BitStoreRegistrationFeatureApi`
- `BitStoreArrayFeatureApi`
- `BitStoreHistoryFeatureApi`

### Why

This reduces coupling and clarifies intent in adapters/plugins.

## Recipe 2: DevTools protocol versioning

### Before

`ACTION`, `PING` and `STATE_UPDATE` could be exchanged without explicit versioning.

### After

- handshake message `HELLO` is sent on connection open
- protocol messages must carry `protocolVersion`
- guards reject incompatible versions
- messages without `protocolVersion` are rejected in v3

### Operational checks

Run `src/tests/devtools/protocol.test.ts` as part of `test:unit`.

## Recipe 3: release gate expansion

### Before

Bundle gates focused mostly on core/framework entries.

### After

Bundle budgets now also cover:

- `devtools/index`
- `devtools/bridge`
- `devtools/protocol` (dist artifact gate)
- `cli/index`

### Operational checks

- `npm run test:bundle-size`
- `npm run test:release-gates`

## Rollback notes

If release gates fail after intentional growth:

1. assess whether growth is expected
2. update budget with documented rationale in PR
3. rerun quality critical checks

For runtime regressions, see `quality/release-gates/rollback-plan.md`.
