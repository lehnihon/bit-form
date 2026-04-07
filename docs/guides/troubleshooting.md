# Troubleshooting

This guide helps you diagnose common Bit-Form issues quickly.

## Form Does Not Re-render As Expected

### Symptoms

- Input value changes in the store, but your component does not update.
- Form-level metadata (`isValid`, `isDirty`) looks stale in the UI.

### Checks

1. Confirm your component is using the correct bindings object for the target store instance.
2. Confirm the field path is correct and matches `initialValues` shape.
3. Confirm you are reading state from hooks/composables/injectors and not from a stale closure.
4. Confirm the field is registered (for dynamic fields, registration can be conditional).

### Fix

- Prefer framework bindings (`useBitField`, `useBitForm`, `injectBitField`, `useBitField` in Vue) over manual reads.
- If using custom adapters, subscribe with `store.observe` and clean up on unmount.

## Async Validation Feels Stuck or Delayed

### Symptoms

- Field remains in validating state.
- Validation message appears too late.

### Checks

1. Verify `asyncValidate` returns a resolved value (`null` for no error or a string/object for error).
2. Verify network function handles timeouts and cancellations.
3. Verify `asyncValidateOn` configuration (`blur` vs `change`).

### Fix

- Add explicit timeout handling in your async validator.
- Keep async validators side-effect free and idempotent.
- Use `change` mode only where immediate feedback is required.

## Hidden Field Still Affects Validation

### Symptoms

- Field is hidden in UI but still blocks submit.

### Checks

1. Confirm the field uses `dependsOn` with `showIf`/`requiredIf` in field config.
2. Confirm you are not using UI-only conditionals without store-level condition logic.

### Fix

- Prefer store-level conditional logic (`dependsOn`, `showIf`, `requiredIf`).
- If UI-only conditional rendering is necessary, manually clean value and errors when hiding.

## DevTools Remote Does Not Connect

### Symptoms

- CLI dashboard is open but no store events appear.

### Checks

1. Ensure remote mode is enabled in store config (`devTools: { mode: "remote" }`).
2. Ensure relay/server command is running and listening on expected host/port.
3. Ensure environment allows WebSocket traffic.

### Fix

- Start relay first, then app.
- Validate host/port match between app config and relay process.
- For mobile/emulator flows, use accessible host IP instead of localhost when required.

## Submit Returns No Field Errors After 422

### Symptoms

- Backend returns validation errors, but fields do not show messages.

### Checks

1. Ensure backend error shape is mappable to field paths.
2. Ensure you call `setServerErrors` or use `onSubmit` helper that maps known shapes.
3. Ensure field paths in response match your current form schema.

### Fix

- Normalize backend payload before mapping.
- Keep field naming consistent between API contract and form paths.

## Diagnostic Checklist

1. Confirm bindings are created from the intended store instance.
2. Confirm field path names and schema shape.
3. Confirm async validators are stable and timeout-safe.
4. Confirm conditional logic is configured in store, not only in UI.
5. Confirm server error payload can be mapped to field paths.
6. Confirm devtools mode and relay host/port settings.

## Related Guides

- [When to Use What](./when-to-use-what.md)
- [Testing Guide](./testing.md)
- [Performance Guide](./performance.md)
- [DevTools Overview](../devtools/index.md)
