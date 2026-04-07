# Testing Guide

Bit-Form is easiest to test when you treat the store as the source of truth and UI bindings as adapters.

## Strategy Overview

- Unit tests: validate store behavior and feature contracts in isolation.
- Integration tests: validate UI bindings and user interactions.
- End-to-end tests: validate real browser/device flows.

## Unit Testing (Store-Level)

Recommended for:

- Validation logic
- Conditional logic
- Computed fields
- Array operations
- Persistence metadata transitions

Example (Vitest):

```ts
import { describe, expect, it } from "vitest";
import { createBitStore } from "@lehnihon/bit-form";

describe("store validation", () => {
  it("marks email as invalid when empty", async () => {
    const store = createBitStore({
      initialValues: { email: "" },
      fields: {
        email: {
          resolver: (value) => (!value ? "Email is required" : null),
        },
      },
    });

    await store.write.validate();
    expect(store.read.getError("email")).toBe("Email is required");
  });
});
```

## Integration Testing (Framework Binding)

Recommended for:

- Hook/composable wiring
- Input events (`onChange`, `onBlur`)
- Submit flow and disabled states

Example patterns:

- React: Testing Library + `createBitReactBindings(store)` or `createBitReactForm(config)`
- Vue: Vue Test Utils + `createBitVueBindings(store)` or `createBitVueForm(config)`
- Angular: TestBed + `createBitAngularBindings(store)` or `createBitAngularForm(config)`

## End-to-End Testing

Recommended for:

- Multi-step forms
- Async server validation
- Upload and persistence flows

Suggested tools:

- Playwright (web)
- Detox or framework-native setup for React Native

## What to Assert

1. Field value changes reflect in store state.
2. Validation errors appear/disappear at expected lifecycle points.
3. Conditional fields are excluded from payload when hidden.
4. Arrays preserve key stability and error reallocation.
5. Submit payload applies transforms and excludes hidden fields.

## Regression Priorities

Keep permanent tests for:

- Async validation rejection isolation.
- Cyclic payload handling in deep operations.
- History + persistence interactions.
- Mask parse/format round-trip correctness.

## Related

- [Troubleshooting](./troubleshooting.md)
- [Complete Form Example](../examples/complete-form-example.md)
