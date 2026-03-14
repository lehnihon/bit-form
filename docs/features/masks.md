# Masks & Formatting

Bit-Form includes a highly advanced, zero-dependency masking engine. It parses user input and formats it for display, while strictly maintaining raw, clean data in the store's state.

## Built-in Presets

Bit-Form ships with a full set of standard presets that can be used instantly by passing their string identifiers.

> **Note:** `registerMask` is designed for **pre-mount registration** only. Register custom masks before creating/mounting the store — dynamic registration after fields are mounted is not supported.

### Currencies

| Key   | Format      |
| ----- | ----------- |
| `brl` | R$ 1.000,00 |
| `usd` | $1,000.00   |
| `eur` | 1.000,00 €  |
| `gbp` | £1,000.00   |
| `jpy` | ¥1,000      |

### Numbers

| Key       | Format        |
| --------- | ------------- |
| `percent` | 10,5%         |
| `decimal` | 1.000,00      |
| `int`     | 1.000         |
| `integer` | 1.000 (alias) |

### Brazil

| Key        | Format             |
| ---------- | ------------------ |
| `cpf`      | 000.000.000-00     |
| `cnpj`     | 00.000.000/0000-00 |
| `rg`       | 00.000.000-X       |
| `cep`      | 00000-000          |
| `cnh`      | 00000000000        |
| `phone`    | (00) 00000-0000    |
| `landline` | (00) 0000-0000     |
| `date`     | DD/MM/YYYY         |
| `time`     | HH:MM              |

### USA

| Key       | Format         |
| --------- | -------------- |
| `usPhone` | (000) 000-0000 |
| `zipCode` | 00000-0000     |
| `dateUS`  | MM/DD/YYYY     |
| `ssn`     | 000-00-0000    |

### Global / Tech

| Key       | Format                                            |
| --------- | ------------------------------------------------- |
| `cc`      | Smart Credit Card (auto-detects Visa/Amex/Diners) |
| `cvv`     | 3-4 digits                                        |
| `dateISO` | YYYY-MM-DD                                        |
| `ip`      | 000.000.000.000                                   |
| `ipv6`    | HHHH:HHHH:HHHH:HHHH:HHHH:HHHH:HHHH:HHHH           |
| `mac`     | HH:HH:HH:HH:HH:HH                                 |
| `color`   | #HHHHHH                                           |
| `iban`    | UU## XXXX XXXX …                                  |

## Defining Masks in Store Fields

Masks are defined in `fields.path.mask` at store construction (or by registering field config in the store).

### Option 1: `fields.path.mask` (declarative)

Define the mask directly on the field. Use built-in names (`"brl"`, `"cpf"`, etc.) or a BitMask instance. For custom masks, register them first with `store.registerMask()`:

```tsx
const store = createBitStore({
  initialValues: { salary: 0 },
  fields: {
    salary: { mask: "brl" },
    age: { mask: "integer" }, // also accepts "int"
    phone: { mask: "usPhone" },
    doc: { mask: "ssn" },
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

const store = createBitStore({
  initialValues: { balance: 0 },
  fields: { balance: { mask: btcMask } },
});
```

> **`precision: 0`** (e.g. `jpy` or `integer`) produces whole-number output only — no decimal separator is appended.
> See the [Masks Example](../examples/masks-example.md) for a full working sample.
