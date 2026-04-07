# Performance Guide

Bit-Form is optimized for localized updates, but form architecture still matters at scale.

## Performance Goals

For large forms, optimize for:

- Minimal unnecessary re-renders
- Low validation overhead
- Predictable async behavior
- Stable subscriptions

## Recommended Practices

1. Keep field bindings local to the component that renders each input.
2. Avoid deriving large computed objects on every render.
3. Use scoped validation for multi-step flows.
4. Prefer targeted subscriptions over broad state polling.
5. Keep async validators lightweight and debounced where appropriate.

## Large Form Pattern

- Split sections by domain (personal info, address, payment).
- Register dynamic fields only when relevant.
- Use scopes to validate current step instead of entire form.

## Validation Cost Control

- Use synchronous resolver for shape/format rules.
- Reserve async validation for server-dependent checks.
- Avoid overlapping async calls for same path without cancellation strategy.

## Subscription Tips

- Use framework hooks/composables/injectors for field-level subscriptions.
- In custom integrations, subscribe to specific paths or meta channels.
- Unsubscribe on teardown to prevent stale listeners.

## Profiling Workflow

1. Reproduce slow flow with stable test data.
2. Run benchmarks from `quality/bench`.
3. Compare baseline before/after change.
4. Validate no regressions in CI variability.

## Performance Regression Checklist

1. Measure bulk updates.
2. Measure async validation bursts.
3. Measure subscription fanout.
4. Measure computed chain updates.
5. Measure history-enabled transactions.

## Related

- [Core Concepts](../02-core-concepts.md)
- [DevTools Remote Dashboard](../devtools/cli-remote-dashboard.md)
