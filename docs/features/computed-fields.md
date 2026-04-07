# Computed Fields

Computed fields are values derived from other form values. When a dependency changes, Bit-Form recalculates only the affected computed graph and commits deterministic updates.

## Scenario

You want to calculate pricing totals in real time:

- `subtotal = price * quantity`
- `tax = subtotal * taxRate`
- `finalTotal = subtotal + tax`

## Store Setup

In V4, `computedDependsOn` is required. This enables a deterministic dependency DAG with no implicit tracking.

```tsx
import { createBitStore } from "@lehnihon/bit-form";

type CheckoutForm = {
  price: number;
  quantity: number;
  taxRate: number;
  subtotal: number;
  tax: number;
  finalTotal: number;
};

const store = createBitStore<CheckoutForm>({
  initialValues: {
    price: 100,
    quantity: 2,
    taxRate: 0.12,
    subtotal: 0,
    tax: 0,
    finalTotal: 0,
  },
  fields: {
    subtotal: {
      computed: (v) => Number(v.price || 0) * Number(v.quantity || 0),
      computedDependsOn: ["price", "quantity"],
    },
    tax: {
      computed: (v) => Number(v.subtotal || 0) * Number(v.taxRate || 0),
      computedDependsOn: ["subtotal", "taxRate"],
    },
    finalTotal: {
      computed: (v) => Number(v.subtotal || 0) + Number(v.tax || 0),
      computedDependsOn: ["subtotal", "tax"],
    },
  },
});
```

## UI Binding (React)

```tsx
import { useBitField, useBitWatch } from "@lehnihon/bit-form/react";

export function CheckoutTotals() {
  const price = useBitField("price");
  const quantity = useBitField("quantity");
  const taxRate = useBitField("taxRate");

  const subtotal = useBitWatch("subtotal");
  const tax = useBitWatch("tax");
  const finalTotal = useBitWatch("finalTotal");

  return (
    <section>
      <label>
        Price
        <input type="number" {...price.props} />
      </label>

      <label>
        Quantity
        <input type="number" {...quantity.props} />
      </label>

      <label>
        Tax Rate
        <input type="number" step="0.01" {...taxRate.props} />
      </label>

      <p>Subtotal: {subtotal}</p>
      <p>Tax: {tax}</p>
      <p>Final total: {finalTotal}</p>
    </section>
  );
}
```

## Common Mistakes

| Wrong                                                          | Correct                     | Why                                |
| -------------------------------------------------------------- | --------------------------- | ---------------------------------- |
| Relying on implicit dependencies                               | Declare `computedDependsOn` | Keeps graph deterministic          |
| Side effects inside `computed`                                 | Keep `computed` pure        | Avoids unstable recomputations     |
| Circular dependencies (`a` depends on `b`, `b` depends on `a`) | Use acyclic graph           | Prevents invalid DAG configuration |

## Testing Computed Behavior

```ts
import { createBitStore } from "@lehnihon/bit-form";
import { describe, expect, it } from "vitest";

describe("computed totals", () => {
  it("recomputes subtotal and finalTotal when quantity changes", () => {
    const store = createBitStore({
      initialValues: { price: 10, quantity: 1, subtotal: 0, finalTotal: 0 },
      fields: {
        subtotal: {
          computed: (v) => v.price * v.quantity,
          computedDependsOn: ["price", "quantity"],
        },
        finalTotal: {
          computed: (v) => v.subtotal,
          computedDependsOn: ["subtotal"],
        },
      },
    });

    store.write.setField("quantity", 3);
    expect(store.read.getValue("subtotal")).toBe(30);
    expect(store.read.getValue("finalTotal")).toBe(30);
  });
});
```

## Related

- [Complete Form Example](../examples/complete-form-example.md)
- [Performance Guide](../guides/performance.md)
