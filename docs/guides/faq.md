# FAQ

## How do I reset the form to initial values?

Use `form.reset()` from framework binding or `store.write.reset()` at store level.

## How do I validate only one step in a wizard?

Use scopes and validate by scope with `useBitScope`/`injectBitScope` patterns.

## When should I use `resolver` vs `asyncValidate`?

- Use `resolver` for shape/format/required rules.
- Use `asyncValidate` for server-dependent checks.

See [When to Use What](./when-to-use-what.md).

## How do I map backend 422 errors to fields?

Use `setServerErrors()` or the `onSubmit` helper flow documented in server-error examples.

## Why is a hidden field still in my payload?

Use store-level conditions (`dependsOn`, `showIf`) so Bit-Form can exclude hidden fields consistently.

## Should I keep masked values in API payload?

Usually no. Keep user-friendly display in UI and submit transformed/raw values.

## How do I test Bit-Form quickly?

Start with store-level unit tests for validation and submit payload behavior, then add integration tests for UI bindings.

See [Testing Guide](./testing.md).
