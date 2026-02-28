# Masks Example

This example shows how to use Bit-Form masks: built-in presets and field-level `fields.path.mask`.

## Store with fields.mask

```tsx
import { BitStore, createPatternMask, createCurrencyMask } from "@lehnihon/bit-form";

const plateMask = createPatternMask("UUU-####");
const btcMask = createCurrencyMask({
  prefix: "₿ ",
  thousand: ",",
  decimal: ".",
  precision: 4,
});

const store = new BitStore({
  initialValues: {
    salary: 0,
    licensePlate: "",
    btcBalance: 0,
  },
  fields: {
    salary: { mask: "brl" },
    licensePlate: { mask: plateMask },
    btcBalance: { mask: btcMask },
  },
});
```

## React usage

```tsx
import { useBitForm, useBitField } from "@lehnihon/bit-form/react";

export function MasksForm() {
  const form = useBitForm();
  const salary = useBitField("salary");
  const plate = useBitField("licensePlate");
  const btc = useBitField("btcBalance");

  return (
    <form onSubmit={form.onSubmit((values) => console.log(values))}>
      <div>
        <label>Salário (BRL)</label>
        <input {...salary.props} placeholder="R$ 0,00" />
      </div>
      <div>
        <label>Placa</label>
        <input {...plate.props} placeholder="ABC-1234" />
      </div>
      <div>
        <label>Saldo BTC</label>
        <input {...btc.props} placeholder="₿ 0.0000" />
      </div>
      <button type="submit">Submit</button>
    </form>
  );
}
```

Masks are applied from `fields.path.mask`; no need to pass `mask` in the hook.

## Overriding mask at hook level

You can still pass `mask` in the hook to override the field config:

```tsx
// Override: use USD instead of BRL for this component
const salary = useBitField("salary", { mask: "usd" });
```

## Submit payload

On submit, values are clean (parsed):

- `salary`: `1500.5` (from "R$ 1.500,50")
- `licensePlate`: `"ABC1234"` (from "ABC-1234")
- `btcBalance`: `0.5` (from "₿ 0.5000")
