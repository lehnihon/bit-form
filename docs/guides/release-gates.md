# Release Gates

Release gates help prevent regressions between API changes and production behavior.

## Recommended Gate Groups

1. Quality benchmarks
2. Compatibility checks
3. API/documentation parity
4. Critical scenario regressions

## Commands

Use repository scripts as release checks:

```bash
npm run test:bench
npm run test:bench:compare
npm run test:compat
npm run test:release-gates
```

## Critical Scenarios

Always validate these before release:

- Async validation rejection isolation
- History and persistence interaction
- Array operations with stable error mapping
- Mask parse/format correctness
- Submit pipeline with server error mapping

## Documentation Sync Gate

Before tagging release:

1. Check public exports and update API docs.
2. Check all links in docs/guides and docs/features.
3. Check framework parity for major feature additions.
4. Publish migration notes for breaking changes.

## Related

- [Migration Guide](./migration.md)
- [Compatibility Matrix](./compatibility-matrix.md)
