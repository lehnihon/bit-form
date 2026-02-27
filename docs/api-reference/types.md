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

Used in the `BitConfig.computed` map.

---

## `BitTransformFn<T>`

Represents a transformation applied to a field before submission.

```ts
type BitTransformFn<T> = (value: any, allValues: T) => any;
```

Used in the `BitConfig.transform` map (per-field transforms).

---

## `BitFieldConfig<T>`

Configuration for an individual field, used either in `BitConfig.fields` or at runtime via `store.registerField`.

```ts
interface BitFieldConfig<T extends object = any> {
  // Dependencies & Conditional Logic
  dependsOn?: string[];
  showIf?: (values: T) => boolean;
  requiredIf?: (values: T) => boolean;

  // Asynchronous Validation
  asyncValidate?: (value: any, values: T) => Promise<string | null | undefined>;
  asyncValidateDelay?: number;
}
```

- **`dependsOn`** — list of field paths that influence visibility/requirement logic.
- **`showIf`** — returns `true` when the field should be visible.
- **`requiredIf`** — returns `true` when the field should be considered required.
- **`asyncValidate`** — field-level async validation; should resolve to an error message or `null`/`undefined` when valid.
- **`asyncValidateDelay`** — debounce delay in milliseconds for `asyncValidate`.

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

Primary configuration object passed to the `BitStore` constructor.

### Nested structure (recommended)

```ts
interface BitConfig<T extends object = any> {
  // Core
  name?: string;
  initialValues?: T;
  fields?: Record<string, BitFieldConfig<T>>;

  // Validation - nested
  validation?: {
    resolver?: ValidatorFn<T>;
    delay?: number;
    defaultRequiredMessage?: string;
  };

  // History - nested
  history?: {
    enabled?: boolean;
    limit?: number;
  };

  // Features - nested
  features?: {
    computed?: Record<string, BitComputedFn<T>>;
    transform?: Partial<Record<string, BitTransformFn<T>>>;
    scopes?: Record<string, string[]>;
    masks?: Record<string, BitMask>;
  };

  // DevTools
  devTools?: boolean | DevToolsOptions;
}
```

### Example

```ts
const store = new BitStore({
  initialValues: { email: "" },
  validation: { resolver: zodResolver(schema), delay: 300 },
  history: { enabled: true, limit: 20 },
  features: {
    scopes: { step1: ["email"] },
    transform: { email: (v) => v?.toLowerCase() },
  },
});
```

Key points:

- `initialValues` is optional at the type level, but the resolved config will always have a non-null `initialValues`.
- `fields` lets you register field configs (`showIf`, `requiredIf`, `asyncValidate`, etc.) in batch at construction. Equivalent to calling `store.registerField(path, config)` for each entry. Prefer this when all fields are known upfront; use `registerField` for dynamic or component-driven config.
- `features.scopes` allows grouping fields (e.g. by wizard step) for per-scope validation.
- `features.transform` lets you normalize values before `submit` calls your handler.
- `features.masks` lets you override or extend the global mask registry.
- `devTools` can be a simple boolean or an object with fine-grained options.

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
