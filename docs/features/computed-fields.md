# Computed Fields

Computed fields are form values derived from other values. When a dependency changes, Bit-Form automatically recalculates the computed field and updates the state.

## Setup

Define computed fields in `fields` via the `computed` property per field.

```tsx
const store = new BitStore({
  initialValues: {
    price: 100,
    quantity: 2,
    total: 0,
    discountedTotal: 0,
  },
  fields: {
    total: { computed: (values) => values.price * values.quantity },
    discountedTotal: { computed: (values) => values.total * 0.9 }, // 10% discount
  },
});
```

## How it works

The `BitComputedManager` evaluates all computed functions whenever the state changes. It performs a **double-pass evaluation**, which means cascading computations (e.g., `discountedTotal` relies on `total`, which relies on `price` and `quantity`) resolve perfectly in real-time.

You can bind these computed fields to readonly inputs or use `useBitWatch("total")` to display the derived values seamlessly in your UI.
