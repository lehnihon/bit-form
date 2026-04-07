# TypeScript Reference

Bit-Form is written in TypeScript and ships first-class types for all core primitives. This section documents the main types you will interact with when using the core store.

Core contracts are now organized by domain under `src/core/store/contracts/public/`:

- `config-types.ts` (store config)
- `field-types.ts` (field definition + validation)
- `path-types.ts` (type-safe paths)
- `state-types.ts` (state/errors/touched)
- `persist-types.ts` (persistence contracts)
- `runtime-types.ts` (scheduler/id/devtools/scope results)
- `plugin-event-types.ts` (operational events)
- `plugin-core-types.ts` (plugin context + hooks)

For compatibility, `src/core/store/contracts/types.ts` continues to re-export these public types.

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
  persist: BitPersistMetadata;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
}
```

- **`values`** — the current values object for your form.
- **`errors`** — map of field errors (see `BitErrors<T>`).
- **`touched`** — map of which fields were interacted with.
- **`isValidating`** — flags for fields that are currently running async validation.
- **`persist`** — runtime persistence metadata (`isSaving`, `isRestoring`, `error`).
- **`isValid`** — `true` when there are no error entries.
- **`isSubmitting`** — `true` while a submission is in progress.
- **`isDirty`** — `true` if `values` differs from `initialValues`.

---

## `BitPersistMetadata`

Runtime metadata for draft persistence operations.

```ts
interface BitPersistMetadata {
  isSaving: boolean;
  isRestoring: boolean;
  error: Error | null;
}
```

---

## `BitDerivedFieldMeta`

Represents normalized field metadata derived by core utilities.

```ts
type BitDerivedFieldMeta = {
  error: string | undefined;
  touched: boolean;
  invalid: boolean;
  isValidating: boolean;
  isDirty: boolean;
  isHidden: boolean;
  isRequired: boolean;
  hasError: boolean;
};
```

Use `deriveFieldMeta` from core utils when building advanced adapters or custom bindings over store slices.

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
type BitComputedFn<T> = (values: T) => unknown;
```

Used in `BitFieldDefinition.computed`.

---

## `BitTransformFn<T>`

Represents a transformation applied to a field before submission.

```ts
type BitTransformFn<T> = (value: unknown, allValues: T) => unknown;
```

Used in `BitFieldDefinition.transform` (per-field transforms).

---

## `BitNormalizeFn<T>`

Represents a normalization applied to a field during runtime writes.

```ts
type BitNormalizeFn<T> = (value: unknown, allValues: T) => unknown;
```

Used in `BitFieldDefinition.normalize` when the store state itself should be normalized after updates.

---

## `BitFieldDefinition<T>`

Configuration for an individual field, used in `BitConfig.fields` or at runtime via `store.registerField`. All field-level config (conditional, validation, normalize, transform, computed, mask, scope) lives here.

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
  asyncValidateOn?: "change" | "blur";
  asyncValidateDelay?: number;
  asyncValidateTimeout?: number;
}

interface BitFieldDefinition<T> {
  conditional?: BitFieldConditional<T>;
  validation?: BitFieldValidation<T>;
  normalize?: (value: any, allValues: T) => any;
  normalizeDependsOn?: string[];
  transform?: (value: any, allValues: T) => any;
  computed?: (values: T) => any;
  mask?: BitMask | string;
  scope?: string;
}
```

- **`conditional`** — visibility and dynamic required logic (`dependsOn`, `showIf`, `requiredIf`, `requiredMessage`).
- **`validation`** — async validation only. `asyncValidateOn` defaults to `"blur"`; use `"change"` for live validation while typing.
- **`validation.asyncValidateDelay`** — debounce (ms) for `"change"` mode.
- **`validation.asyncValidateTimeout`** — optional timeout (ms) for async validation. When exceeded, the pending async result is ignored and `isValidating` is cleared for that field.
- **`normalize`** — applied to runtime state after writes/batches.
- **`normalizeDependsOn`** — list of paths that, when changed, trigger this normalizer. Defaults to `[path]` (the field's own path). Use this to run a normalizer only when a specific dependency changes instead of on every write. This enables **incremental normalization**: only affected normalizers run per batch, reducing overhead in large forms.
- **`transform`** — applied only when preparing the submit payload.
- **`computed`** — derives value from other fields.
- **`mask`** — mask name or instance.
- **`scope`** — scope name (e.g. wizard step).

#### `normalizeDependsOn` examples

```ts
// Default: normalizer runs when "email" changes (own path)
fields: {
  email: { normalize: (v) => String(v).trim() }
}

// Runs when "firstName" or "lastName" changes:
fields: {
  fullName: {
    computed: (v) => `${v.firstName} ${v.lastName}`,
    normalize: (v) => String(v).trim(),
    normalizeDependsOn: ["firstName", "lastName"],
  }
}

// Prefix match: runs when any sub-field of "address" changes:
fields: {
  "address.display": {
    normalize: (v, all: any) => `${all.address.street}, ${all.address.city}`,
    normalizeDependsOn: ["address"],
  }
}
```

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
  idFactory?: BitIdFactory;
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
  persist?: BitPersistConfig<T>;
  plugins?: BitPlugin<T>[];
}
```

`idFactory` customizes runtime id generation for internal store ids and array field keys.

```ts
type BitIdFactoryContext = {
  scope: "store" | "array";
  path?: string;
  index?: number;
  storeName?: string;
};

type BitIdFactory = (context: BitIdFactoryContext) => string;
```

### Example

```ts
const store = createBitStore({
  initialValues: { email: "" },
  validation: { resolver: zodResolver(schema), delay: 300 },
  history: { enabled: true, limit: 20 },
  fields: {
    email: {
      normalize: (v) => v?.trim(),
      transform: (v) => v?.toLowerCase(),
      scope: "step1",
    },
  },
});
```

Key points:

- `initialValues` is optional at the type level, but the resolved config will always have a non-null `initialValues`.
- `fields` is the single source for field config: conditional, validation, normalize, transform, computed, mask, scope. Masks are set per field via `fields.path.mask` (name or instance). Custom masks should be defined in the `masks` option of the store config.

---

## `BitPersistStorageAdapter`

Storage contract used by persistence. Supports sync or async adapters.

```ts
interface BitPersistStorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}
```

---

## `BitPersistMode`

Selects which payload is persisted.

```ts
type BitPersistMode = "values" | "dirtyValues";
```

---

## `BitPersistConfig<T>`

Configuration object for local draft persistence.

```ts
interface BitPersistConfig<T extends object = any> {
  enabled?: boolean;
  key?: string;
  storage?: BitPersistStorageAdapter;
  autoSave?: boolean;
  debounceMs?: number;
  mode?: BitPersistMode;
  serialize?: (payload: unknown) => string;
  deserialize?: (raw: string) => Partial<T>;
  onError?: (error: unknown) => void;
}
```

See [Draft Persistence](../features/persistence.md) for behavior and defaults.

---

## `BitPlugin<T>`

Lifecycle plugin contract.

```ts
interface BitPlugin<T extends object = any> {
  name: string;
  setup?: (context: BitPluginContext<T>) => void | (() => void);
  hooks?: BitPluginHooks<T>;
}
```

Hook coverage:

- `beforeValidate`
- `afterValidate`
- `beforeSubmit`
- `afterSubmit`
- `onFieldChange`
- `onError`

See [Lifecycle Plugins](../features/plugins.md) for examples and behavior.

---

## `BitFrameworkConfig<T>`

Public framework-facing config returned by `store.read.config`. It includes normalized defaults and resolved config sections.

```ts
interface BitFrameworkConfig<T extends object = any> extends BitConfig<T> {
  initialValues: T;
  validationDelay: number;
  enableHistory: boolean;
  historyLimit: number;
  persist: BitPersistResolvedConfig<T>;
}
```

`BitResolvedConfig<T>` remains internal to the core store implementation.

---

For advanced adapter/binding/store helper exports, see [Advanced Core API](./advanced-core.md).
