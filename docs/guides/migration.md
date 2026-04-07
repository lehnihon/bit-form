# Migration Guide

This guide provides practical upgrade paths for Bit-Form major versions.

## Version Policy

- Major versions may include breaking changes.
- Minor and patch versions aim to remain backward compatible.
- Always review changelog and API reference before upgrading.

## Upgrade Checklist

1. Upgrade dependency in a dedicated branch.
2. Run type-check and tests.
3. Audit framework integration points (`react`, `vue`, `angular`, `react-native`).
4. Validate masking, async validation, arrays, and persistence in integration tests.
5. Run release-gate tests.

## v4 to v5 (Planning Checklist)

Use this section as a controlled migration plan when your project adopts v5 features.

1. Confirm all direct store usage follows namespaced access (`read`, `observe`, `write`, `feature`).
2. Confirm custom utilities rely on stable public APIs and not internal store internals.
3. Re-test `rebase` and history behavior if your flows rely on dirty baseline semantics.
4. Re-test custom framework adapters and advanced integrations.

## Breaking-Change Audit Template

For each release candidate, record:

- Changed export names
- Changed method signatures
- Removed utilities
- Behavior changes in validation/history/persistence

## Rollback Plan

If migration introduces regressions:

1. Revert dependency to previous stable major.
2. Keep migration branch open with reduced scope changes.
3. Patch integration tests for known drift and retry migration in smaller batches.

## Related

- [Compatibility Matrix](./compatibility-matrix.md)
- [Release Gates](./release-gates.md)
- [Type Definitions](../api-reference/types.md)
