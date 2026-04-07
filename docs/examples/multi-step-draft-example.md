# Multi-Step Wizard + Draft Persistence Example

## Scenario

A checkout wizard should validate per step and preserve draft state if the user leaves and returns.

## Goal

Combine scopes with persistence controls in a practical flow.

## Store Setup

```tsx
import { createBitStore } from "@lehnihon/bit-form";

type Checkout = {
  customer: { name: string; email: string };
  shipping: { city: string; zip: string };
};

export const store = createBitStore<Checkout>({
  initialValues: {
    customer: { name: "", email: "" },
    shipping: { city: "", zip: "" },
  },
  fields: {
    "customer.name": { scope: "step1" },
    "customer.email": { scope: "step1" },
    "shipping.city": { scope: "step2" },
    "shipping.zip": { scope: "step2", mask: "zipCode" },
  },
  persist: {
    enabled: true,
    key: "checkout-draft-v1",
    autoSave: true,
    debounceMs: 300,
    mode: "values",
  },
});
```

## React UI Outline

```tsx
import {
  useBitPersist,
  useBitScope,
  useBitSteps,
} from "@lehnihon/bit-form/react";

export function CheckoutWizard() {
  const steps = useBitSteps(["step1", "step2"]);
  const step1 = useBitScope("step1");
  const persist = useBitPersist();

  return (
    <div>
      <button type="button" onClick={() => void persist.restore()}>
        Restore draft
      </button>

      <button
        type="button"
        onClick={() => void steps.next()}
        disabled={step1.isValidating}
      >
        Next
      </button>

      <button type="button" onClick={() => void persist.save()}>
        Save now
      </button>

      <button type="button" onClick={() => void persist.clear()}>
        Clear draft
      </button>
    </div>
  );
}
```

## Expected Behavior

- Step validation runs per scope.
- Draft persists automatically and can be restored manually.
- Clearing draft removes persisted payload and metadata state.

## Related

- [Scopes](../features/scopes.md)
- [Persistence](../features/persistence.md)
