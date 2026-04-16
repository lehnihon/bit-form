# Normalization

Use `normalize` when the runtime store value itself should be cleaned or standardized immediately after writes.

Common examples:

- Trim whitespace from text inputs
- Lowercase emails or slugs in state
- Collapse repeated spaces before validation runs
- Recalculate a normalized helper field when another path changes

`normalize` runs during the store update pipeline. The normalized value is committed to `state.values` before computed fields are applied.

## When to Use `normalize`

Choose `normalize` when you want the stored value to be the cleaned value during normal form interaction.

Use it for:

- Runtime cleanup after `setField`, `setValues`, batches, initialization, and reset
- Canonical values that validations and UI watchers should see immediately
- Incremental normalization with explicit dependencies via `normalizeDependsOn`

Do not use it for:

- Display formatting while typing: use `mask`
- Submit-only conversion: use `transform`
- Pure derived read-only values: usually prefer `computed`

## Basic Example

Normalize the field's own value as the user types:

```ts
import { createBitStore } from "@lehnihon/bit-form";

const store = createBitStore({
  initialValues: {
    email: "",
    coupon: "",
  },
  fields: {
    email: {
      normalize: (value) =>
        String(value ?? "")
          .trim()
          .toLowerCase(),
    },
    coupon: {
      normalize: (value) =>
        String(value ?? "")
          .trim()
          .toUpperCase(),
    },
  },
});

store.write.setField("email", "  USER@Example.COM  ");
store.write.setField("coupon", "  spring25  ");

store.read.getState().values;
// {
//   email: "user@example.com",
//   coupon: "SPRING25"
// }
```

If `normalizeDependsOn` is omitted, Bit-Form treats the field path itself as the dependency. In practice, that means the normalizer runs when that field changes.

## Cross-Field Normalization with `normalizeDependsOn`

Use `normalizeDependsOn` when a field normalizer must rerun because another path changed.

```ts
type ContactForm = {
  firstName: string;
  lastName: string;
  searchKey: string;
};

const store = createBitStore<ContactForm>({
  initialValues: {
    firstName: "",
    lastName: "",
    searchKey: "",
  },
  fields: {
    firstName: {
      normalize: (value) => String(value ?? "").trim(),
    },
    lastName: {
      normalize: (value) => String(value ?? "").trim(),
    },
    searchKey: {
      normalize: (_value, values) =>
        `${values.firstName} ${values.lastName}`.trim().toLowerCase(),
      normalizeDependsOn: ["firstName", "lastName"],
    },
  },
});

store.write.setField("firstName", "  Ana  ");
store.write.setField("lastName", "  Silva  ");

store.read.getState().values.searchKey;
// "ana silva"
```

This pattern is useful for helper fields that should stay normalized in runtime state. If the field is purely derived and should not behave like mutable form state, prefer `computed`.

## Prefix Dependencies

Dependencies support prefix matching. If you depend on `address`, a change in `address.street` or `address.city` will trigger the normalizer.

```ts
type AddressForm = {
  address: {
    street: string;
    city: string;
  };
  addressSummary: string;
};

const store = createBitStore<AddressForm>({
  initialValues: {
    address: { street: "", city: "" },
    addressSummary: "",
  },
  fields: {
    addressSummary: {
      normalize: (_value, values) =>
        `${values.address.street}, ${values.address.city}`
          .replace(/^,\s*|,\s*$/g, "")
          .trim(),
      normalizeDependsOn: ["address"],
    },
  },
});

store.write.setField("address.street", "5th Avenue");

store.read.getValue("addressSummary");
// "5th Avenue"
```

## Runtime Semantics

- `normalize` runs after writes and batch updates.
- Initialization and `reset()` run all normalizers.
- `normalizeDependsOn` filters which normalizers rerun for a given batch.
- Normalizers are ordered by dependency when one normalized field depends on another normalized field.
- Computed fields run after normalization.

This keeps updates incremental in large forms: only affected normalizers execute for each batch.

## Choosing Between `normalize`, `computed`, `transform`, and `mask`

| Feature     | Best for                     | When it runs              |
| ----------- | ---------------------------- | ------------------------- |
| `normalize` | Clean runtime state          | After writes and batches  |
| `computed`  | Derived reactive values      | After dependencies change |
| `transform` | Submit payload conversion    | Only before submit        |
| `mask`      | Input formatting and parsing | During field interaction  |

Rules of thumb:

- User should see and interact with the cleaned value in state: `normalize`
- User should see a derived value recalculated from other fields: `computed`
- Backend needs a different payload shape or raw value: `transform`
- Input needs formatting like currency, CPF, phone, or date: `mask`

## Common Mistakes

| Wrong                                                              | Better choice                 | Why                                                                     |
| ------------------------------------------------------------------ | ----------------------------- | ----------------------------------------------------------------------- |
| Using `normalize` to strip currency formatting only at submit time | `transform`                   | Keeps UI state user-friendly and converts only for the outbound payload |
| Using `normalize` for phone or CPF display formatting              | `mask`                        | Masks handle typing UX and formatting rules                             |
| Building a read-only total field with `normalize`                  | `computed`                    | Computed is clearer for reactive derivations                            |
| Forgetting `normalizeDependsOn` for cross-field normalizers        | Declare explicit dependencies | Avoids unnecessary reruns and stale helper fields                       |

## Related

- [Core Types](../api-reference/types.md)
- [Computed Fields](./computed-fields.md)
- [Masks](./masks.md)
- [When to Use What](../guides/when-to-use-what.md)
