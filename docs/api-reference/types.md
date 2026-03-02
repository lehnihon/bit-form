# TypeScript Reference

Bit-Form is written in TypeScript and ships first-class types for all core primitives. This section documents the main types you will interact with when using the core store.

---

## `BitErrors<T>`

Represents the map of validation errors for the form.

```ts
type BitErrors<T> = { [key: string]: string | undefined };
```

Each key is a field path (e.g. `"email"`, `"address.zip"`), and the value is either a string error message or `undefined` when there is no error.

---

## `BitTouched<T>`

Records which fields have been interacted with (typically via `blurField`).

```ts
type BitTouched<T> = { [key: string]: boolean | undefined };
```

If a key is `true`, the field has been "touched"; missing keys or `undefined` are interpreted as not touched.

---

## `BitState<T>`

Represents the full state owned by a `BitStore<T>`.

```ts
interface BitState<T> {
  values: T;
  errors: BitErrors<T>;
  touched: BitTouched<T>;
  isValidating: Record<string, boolean>;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
}
```

- **`values`** — the current values object for your form.
- **`errors`** — map of field errors (see `BitErrors<T>`).
- **`touched`** — map of which fields were interacted with.
- **`isValidating`** — flags for fields that are currently running async validation.
- **`isValid`** — `true` when there are no error entries.
- **`isSubmitting`** — `true` while a submission is in progress.
- **`isDirty`** — `true` if `values` differs from `initialValues`.

---

## `ValidatorFn<T>`

Signature for custom resolvers used in `BitConfig.resolver`.

```ts
type ValidatorFn<T> = (
  values: T,
  options?: { scopeFields?: string[] },
) => Promise<BitErrors<T>> | BitErrors<T>;
```

- You can return errors synchronously or as a Promise.
- `scopeFields` is used internally when validating a subset of fields.

---

## `BitComputedFn<T>`

Represents a function that derives a computed value from the current `values`.

```ts
type BitComputedFn<T> = (values: T) => any;
```

Used in `BitFieldDefinition.computed`.

---

## `BitTransformFn<T>`

Represents a transformation applied to a field before submission.

```ts
type BitTransformFn<T> = (value: any, allValues: T) => any;
```

Used in `BitFieldDefinition.transform` (per-field transforms).

---

## `BitFieldDefinition<T>`

Configuration for an individual field, used in `BitConfig.fields` or at runtime via `store.registerField`. All field-level config (conditional, validation, transform, computed, mask, scope) lives here.

```ts
interface BitFieldConditional<T> {
  dependsOn?: string[];
  showIf?: (values: T) => boolean;
  requiredIf?: (values: T) => boolean;
  /** Custom message when field is required but empty. Fallback: "required field". */
  requiredMessage?: string;
}

interface BitFieldValidation<T> {
  asyncValidate?: (value: any, values: T) => Promise<string | null | undefined>;
  asyncValidateDelay?: number;
}

interface BitFieldDefinition<T> {
  conditional?: BitFieldConditional<T>;
  validation?: BitFieldValidation<T>;
  transform?: (value: any, allValues: T) => any;
  computed?: (values: T) => any;
  mask?: BitMask | string;
  scope?: string;
}
```

- **`conditional`** — visibility and dynamic required logic (`dependsOn`, `showIf`, `requiredIf`, `requiredMessage`).
- **`validation`** — async validation only.
- **`transform`** — applied before submit.
- **`computed`** — derives value from other fields.
- **`mask`** — mask name or instance.
- **`scope`** — scope name (e.g. wizard step).

---

## `DevToolsOptions`

Options for enabling DevTools in the config.

```ts
interface DevToolsOptions {
  enabled?: boolean;
  mode?: "local" | "remote";
  url?: string;
}
```

These options are used via the `BitConfig.devTools` property.

---

## `BitConfig<T>`

Primary configuration object passed to the `BitStore` constructor. `fields` is the central prop for all field-level config.

```ts
interface BitConfig<T extends object = any> {
  name?: string;
  initialValues?: T;
  fields?: Record<string, BitFieldDefinition<T>>;
  validation?: {
    resolver?: ValidatorFn<T>;
    delay?: number;
  };
  history?: {
    enabled?: boolean;
    limit?: number;
  };
  devTools?: boolean | DevToolsOptions;
}
```

### Example

```ts
const store = new BitStore({
  initialValues: { email: "" },
  validation: { resolver: zodResolver(schema), delay: 300 },
  history: { enabled: true, limit: 20 },
  fields: {
    email: {
      transform: (v) => v?.toLowerCase(),
      scope: "step1",
    },
  },
});
```

Key points:

- `initialValues` is optional at the type level, but the resolved config will always have a non-null `initialValues`.
- `fields` is the single source for field config: conditional, validation, transform, computed, mask, scope. Masks are set per field via `fields.path.mask` (name or instance). Custom masks are registered with `store.registerMask()`.

---

## `BitResolvedConfig<T>`

Internal form of the configuration, exposing a non-optional `initialValues`.

```ts
type BitResolvedConfig<T extends object> = BitConfig<T> & {
  initialValues: T;
};
```

You will rarely use this directly, but it is returned by `store.getConfig()`.

---

## `BitFieldOptions`

Additional options for field hooks/composables in framework integrations.

```ts
interface BitFieldOptions {
  mask?: BitMask | string;
}
```

This is typically used at the adapter layer (e.g. `useBitField("price", { mask: "currency" })`).
