# Masks & Formatting

Bit-Form includes a highly advanced, zero-dependency masking engine. It parses user input and formats it for display, while strictly maintaining raw, clean data in the store's state.

## Built-in Presets

Bit-Form comes packed with standard presets that you can use instantly by passing their string identifiers.

### Available String Presets

- **Currencies**: `brl`, `usd`, `eur`, `gbp`, `jpy`
- **Numbers**: `percent`, `decimal`, `int`
- **Brazil**: `cpf`, `cnpj`, `rg`, `cep`, `cnh`, `phone`, `landline`, `date`
- **USA**: `usPhone`, `zipCode`, `dateUS`, `ssn`
- **Global/Tech**: `cc` (Smart Credit Card), `cvv`, `dateISO`, `ip`, `ipv6`, `mac`, `color`

## Defining Masks: fields vs Hook Options

You can define masks in two ways:

1. **In `fields.path.mask`** — declare the mask per field at store construction.
2. **In the hook** — pass `mask` via `useBitField(path, { mask: "brl" })` to override or when not using `fields`.

### Option 1: `fields.path.mask` (declarative)

Define the mask directly on the field. Use built-in names (`"brl"`, `"cpf"`, etc.) or a BitMask instance. For custom masks, register them first with `store.registerMask()`:

```tsx
const store = new BitStore({
  initialValues: { salary: 0 },
  fields: {
    salary: { mask: "brl" },
  },
});

// No need to pass mask in the hook — it's read from the field config
const salary = useBitField("salary");
```

### Option 2: Hook options (override or ad‑hoc)

Pass `mask` in the hook when you need to override or don't use `fields`:

```tsx
const salary = useBitField("salary", { mask: "brl" });
const plate = useBitField("licensePlate", { mask: myCustomMask });
```

Hook options take precedence over `fields.path.mask`.

## Custom Masks

Create custom masks with `createPatternMask`, `createCurrencyMask`, and `createDateMask`.

### Pattern Masks

Use tokens (`#` numbers, `A` letters, `U` uppercase):

```tsx
import { createPatternMask } from "bit-form";

const plateMask = createPatternMask("UUU-####");

// Via fields (or register first with store.registerMask("plate", plateMask))
const store = new BitStore({
  initialValues: { licensePlate: "" },
  fields: { licensePlate: { mask: plateMask } },
});

// Or inline in hook
const plate = useBitField("licensePlate", { mask: plateMask });
```

Dynamic patterns (e.g. phone):

```tsx
const phoneMask = createPatternMask([
  "(##) ####-####",
  "(##) #####-####",
]);
```

### Currency Masks

```tsx
import { createCurrencyMask } from "bit-form";

const btcMask = createCurrencyMask({
  prefix: "₿ ",
  thousand: ",",
  decimal: ".",
  precision: 4,
});

// Pass instance in fields, or register and use by name
const store = new BitStore({
  initialValues: { balance: 0 },
  fields: { balance: { mask: btcMask } },
});
```

### Raw Value vs Display Value

When you type `"R$ 1.500,50"` with the `brl` mask, the store saves the number `1500.5`. On submit you send clean data; no manual parsing needed.

See the [Masks Example](../examples/masks-example.md) for a full working sample.
