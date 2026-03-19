# Computed Fields

Computed fields are form values derived from other values. When a dependency changes, Bit-Form automatically recalculates the computed field and updates the state.

## Setup

Define computed fields in `fields` via the `computed` property per field.
In V4, `computedDependsOn` is mandatory so the engine can build a deterministic dependency graph with no implicit tracking.

```tsx
const store = createBitStore({
  initialValues: {
    price: 100,
    quantity: 2,
    total: 0,
    discountedTotal: 0,
  },
  fields: {
    total: {
      computed: (values) => values.price * values.quantity,
      computedDependsOn: ["price", "quantity"],
    },
    discountedTotal: {
      computed: (values) => values.total * 0.9,
      computedDependsOn: ["total"],
    }, // 10% discount
  },
});
```

## How it works

The `BitComputedManager` evaluates only the affected computed graph whenever a dependency changes. In V4 it uses an ordered DAG derived from `computedDependsOn`, so cascading computations (e.g. `discountedTotal` relies on `total`, which relies on `price` and `quantity`) resolve in a single deterministic pass.

You can bind these computed fields to readonly inputs or use `useBitWatch("total")` to display the derived values seamlessly in your UI.
