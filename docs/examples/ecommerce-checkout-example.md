# E-commerce Checkout Example (Advanced)

## Scenario

A checkout form combines nested objects, item arrays, computed totals, async shipping quote, and draft persistence.

## Goal

Show a realistic high-complexity form architecture using Bit-Form primitives.

## Store Setup

```tsx
import { createBitStore } from "@lehnihon/bit-form";

type Item = { sku: string; qty: number; price: number };

type Checkout = {
  customer: { name: string; email: string };
  shipping: { zip: string; method: "standard" | "express"; quote: number };
  items: Item[];
  subtotal: number;
  total: number;
};

export const store = createBitStore<Checkout>({
  initialValues: {
    customer: { name: "", email: "" },
    shipping: { zip: "", method: "standard", quote: 0 },
    items: [{ sku: "SKU-1", qty: 1, price: 120 }],
    subtotal: 0,
    total: 0,
  },
  persist: {
    enabled: true,
    key: "checkout-example-v1",
    autoSave: true,
    debounceMs: 300,
  },
  fields: {
    "customer.name": { scope: "customer" },
    "customer.email": { scope: "customer" },
    "shipping.zip": {
      scope: "shipping",
      mask: "zipCode",
      validation: {
        asyncValidate: async (value, values) => {
          if (!value) return "ZIP is required";
          const quote = await api.getShippingQuote(String(value), values.items);
          store.write.setField("shipping.quote", quote);
          return null;
        },
        asyncValidateOn: "blur",
      },
    },
    "shipping.method": { scope: "shipping" },
    subtotal: {
      computed: (v) =>
        v.items.reduce(
          (acc, item) => acc + Number(item.qty) * Number(item.price),
          0,
        ),
      computedDependsOn: ["items"],
    },
    total: {
      computed: (v) => Number(v.subtotal || 0) + Number(v.shipping.quote || 0),
      computedDependsOn: ["subtotal", "shipping.quote"],
    },
  },
});
```

## Expected Behavior

- `subtotal` reacts to item quantity and price updates.
- `shipping.quote` updates after ZIP async validation.
- `total` updates after either subtotal or shipping quote changes.
- Draft can be restored after page refresh.

## Related

- [Computed Fields](../features/computed-fields.md)
- [Field Arrays](../features/field-arrays.md)
- [Persistence](../features/persistence.md)
- [Performance Guide](../guides/performance.md)
