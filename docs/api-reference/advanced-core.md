# Advanced Core API Reference

This page documents advanced public exports intended for framework integrations, custom adapters, and tooling.

## Store Adapter and Resolution

From package root (`@lehnihon/bit-form`):

- `resolveBitStoreForHooks`
- `createFrameworkStoreAdapter`

Use these only when building custom integration layers. Application code should usually interact through framework bindings.

## Store Slice Extractors

From core store public surface:

- `extractReadSlice`
- `extractObserveSlice`
- `extractWriteSlice`
- `extractFeatureSlice`
- `extractSlices`

These helpers are useful when composing utilities that should only receive a subset of capabilities.

## Binding Helpers

From `@lehnihon/bit-form/core/bindings`:

- `createArrayBinding`
- `createFrameworkMaskedFieldBinding`
- `createFrameworkFormBinding`
- `cleanupRegisteredField`
- `cleanupRegisteredPrefix`
- `formatMaskedValue`
- `parseMaskedInput`

## Utility Exports

From `@lehnihon/bit-form/core/utils`:

- `deriveFieldMeta`
- `createFieldStateSnapshot`
- `areFieldSnapshotsEqual`
- `getDeepValue`
- `setDeepValue`
- `deepClone`
- `deepMerge`
- `deepEqual`
- `valueEqual`
- `extractServerErrors`

## Stability Guidance

- Prefer framework packages for app-level code.
- Treat this page as advanced integration surface.
- Re-validate this list at each release with export parity checks.

## Related

- [Bit Store API](./bit-store.md)
- [TypeScript Reference](./types.md)
- [Release Gates](../guides/release-gates.md)
