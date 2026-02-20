# Masks & Formatting

Bit-Form includes a highly advanced, zero-dependency masking engine. It parses user input and formats it for display, while strictly maintaining raw, clean data in the store's state.

## Built-in Presets

Bit-Form comes packed with standard presets that you can use instantly by passing their string identifiers.

```tsx
import { useBitField } from "bit-form/react"; // or vue, angular, etc.

export function SalaryInput() {
  // Uses the Brazilian Real currency preset automatically
  const salary = useBitField("salary", { mask: "brl" });

  return <input {...salary.props} />;
}
```

### Available String Presets

- **Currencies**: `brl`, `usd`, `eur`, `gbp`, `jpy`
- **Numbers**: `percent`, `decimal`, `int`
- **Brazil**: `cpf`, `cnpj`, `rg`, `cep`, `cnh`, `phone`, `landline`, `date`
- **USA**: `usPhone`, `zipCode`, `dateUS`, `ssn`
- **Global/Tech**: `cc` (Smart Credit Card), `cvv`, `dateISO`, `ip`, `ipv6`, `mac`, `color`

## Custom Masks

If you need a specific format, you can create a custom mask using our creators: `createPatternMask`, `createCurrencyMask`, and `createDateMask`.

### Pattern Masks

Use standard tokens (`#` for numbers, `A` for letters, `U` for uppercase letters) to define shapes.

```tsx
import { createPatternMask } from "bit-form";

const myCustomMask = createPatternMask("UUU-####");

// Apply it directly to the field
const plate = useBitField("licensePlate", { mask: myCustomMask });
```

You can also pass an array of patterns for dynamic switching (e.g., a phone number that adds a digit):

```tsx
const phoneMask = createPatternMask([
  "(##) ####-####", // 10 digits
  "(##) #####-####", // 11 digits
]);
```

### Currency Masks

```tsx
import { createCurrencyMask } from "bit-form";

const customCurrency = createCurrencyMask({
  prefix: "₿ ",
  thousand: ",",
  decimal: ".",
  precision: 4,
});
```

### Raw Value vs Display Value

When you type `"R$ 1.500,50"` into an input using the `brl` mask, the `BitStore` parses it and saves the `float` number `1500.5` in its state. When you submit the form, you send clean data to your API, eliminating the need to parse strings manually before submitting.
