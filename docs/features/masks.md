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

## Defining Masks in Store Fields

Masks are defined in `fields.path.mask` at store construction (or by registering field config in the store).

### Option 1: `fields.path.mask` (declarative)

Define the mask directly on the field. Use built-in names (`"brl"`, `"cpf"`, etc.) or a BitMask instance. For custom masks, register them first with `store.registerMask()`:

```tsx
const store = createBitStore({
  initialValues: { salary: 0 },
  fields: {
    salary: { mask: "brl" },
  },
});

// No need to pass mask in the hook — it's read from the field config
const salary = useBitField("salary");
```

## Custom Masks

Create custom masks with `createPatternMask`, `createCurrencyMask`, and `createDateMask`.

### Pattern Masks

Use tokens (`#` numbers, `A` letters, `U` uppercase):

```tsx
import { createPatternMask } from "@lehnihon/bit-form";

const plateMask = createPatternMask("UUU-####");

// Via fields (or register first with store.registerMask("plate", plateMask))
const store = createBitStore({
  initialValues: { licensePlate: "" },
  fields: { licensePlate: { mask: plateMask } },
});

const plate = useBitField("licensePlate");
```

Dynamic patterns (e.g. phone):

```tsx
const phoneMask = createPatternMask(["(##) ####-####", "(##) #####-####"]);
```

### Currency Masks

```tsx
import { createCurrencyMask } from "@lehnihon/bit-form";

const btcMask = createCurrencyMask({
  prefix: "₿ ",
  thousand: ",",
  decimal: ".",
  precision: 4,
});

// Pass instance in fields, or register and use by name
const store = createBitStore({
  initialValues: { balance: 0 },
  fields: { balance: { mask: btcMask } },
});
```

### Raw Value vs Display Value

When you type `"R$ 1.500,50"` with the `brl` mask, the store saves the number `1500.5`. On submit you send clean data; no manual parsing needed.

See the [Masks Example](../examples/masks-example.md) for a full working sample.
