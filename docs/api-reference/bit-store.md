# BitStore API

The `BitStore` is the core engine of Bit-Form. It is a framework-agnostic class that owns the form state, validations, dependencies, computed values, masks, history, and integrations with DevTools.

All framework bindings (`useBitForm`, `injectBitForm`, etc.) are thin adapters on top of `BitStore`.

```ts
import { BitStore } from "@lehnihon/bit-form";

const store = new BitStore<MyFormValues>({
  initialValues: {
    name: "",
    email: "",
  },
  validation: {
    resolver: async (values) => {
      const errors: Record<string, string | undefined> = {};
      if (!values.email) errors.email = "Email is required";
      return errors;
    },
  },
});
```

- **Type parameter**: `T` — the shape of `values`. Defaults to `any` if omitted.
- **Parameter**: `config?: BitConfig<T>` — see [Types Reference](./types.md) for all options.

---

## Core State & Accessors

### `getState(): BitState<T>`

Returns the current snapshot of the store state.

```ts
const state = store.getState();
// state.values, state.errors, state.isValid, etc.
```

See [`BitState<T>` in the types reference](./types.md#bitstatet) for the full structure.

### `getConfig(): BitResolvedConfig<T>`

Returns the resolved configuration, including normalized defaults and `initialValues`.

```ts
const config = store.getConfig();
console.log(config.initialValues);
```

### Derived flags

These read-only getters mirror common flags from `BitState`:

- **`store.isValid: boolean`** — `true` when there are no validation errors.
- **`store.isSubmitting: boolean`** — `true` while a submission is in progress.
- **`store.isDirty: boolean`** — `true` if any field differs from `initialValues`.

They are equivalent to reading `getState().isValid`, `getState().isSubmitting`, and `getState().isDirty`.

---

## Subscriptions & Watching

### `subscribe(listener: () => void): () => void`

Registers a listener that is called on every state update. Returns an unsubscribe function.

```ts
const unsubscribe = store.subscribe(() => {
  const state = store.getState();
  console.log("Values changed:", state.values);
});

// Later
unsubscribe();
```

### `watch(path: string, callback: (value: any) => void): () => void`

Subscribes to changes for a specific field path. The callback is only called when the value at that path actually changes (deep comparison).

```ts
const stopWatching = store.watch("user.address.city", (city) => {
  console.log("City changed:", city);
});
```

Use this for side-effects like analytics, autosave, or cross-form coordination.

---

## Field & Value Management

### `setField(path: string, value: any): void`

Updates a single field value by path.

- Applies computed fields.
- Evaluates dependencies (`showIf`, `requiredIf`).
- Triggers validation lifecycle (depending on your `resolver` & async validation configuration).

```ts
store.setField("email", "john@example.com");
```

### `setValues(newValues: T): void`

Replaces the entire `values` object in a single operation, then:

- Re-applies all computed fields.
- Re-runs dependency visibility logic.

```ts
store.setValues({
  name: "John",
  email: "john@example.com",
});
```

### `blurField(path: string): void`

Signals that a field has been blurred (lost focus).

- Marks the field as `touched`.
- Saves a history snapshot (if history is enabled).
- Triggers validation for that field.

```ts
store.blurField("email");
```

### `reset(): void`

Resets the form to `initialValues` and clears errors, touched state and dirty flags (through the lifecycle manager).

```ts
store.reset();
```

---

## Validation & Errors

### `validate(options?: { scope?: string; scopeFields?: string[] }): Promise<boolean>`

Runs validation for the configured resolver and returns whether the form is valid.

- **`scope`**: name of a scope defined in `BitConfig.scopes` (e.g. a wizard step).
- **`scopeFields`**: explicit list of field paths to validate.

```ts
const isValid = await store.validate();
const stepValid = await store.validate({ scope: "shipping" });
```

### `setError(path: string, message: string | undefined): void`

Manually sets (or clears) a single field error.

```ts
store.setError("email", "Email already taken");
store.setError("email", undefined); // clear
```

### `setErrors(errors: BitErrors<T>): void`

Merges a partial set of errors into the current error map.

```ts
store.setErrors({
  email: "Invalid email",
  name: "Name is required",
});
```

### `setServerErrors(serverErrors: Record<string, string | string[]>): void`

Helper for mapping server-side validation responses into the internal error structure.

- For array values, only the **first** message is used.
- Automatically marks the form as invalid.

```ts
store.setServerErrors({
  email: ["Email already taken"],
  "address.zip": "Invalid ZIP code",
});
```

### `isFieldValidating(path: string): boolean`

Returns `true` if the given field is currently running an asynchronous validation.

```ts
if (store.isFieldValidating("email")) {
  // show a loading indicator for the email field
}
```

---

## Dependencies & Visibility

These methods let you query the dependency manager directly.

### `isHidden(path: string): boolean`

Returns `true` if the field is currently hidden due to its `showIf` condition.

```ts
if (store.isHidden("company.name")) {
  // do not render that field
}
```

### `isRequired(path: string): boolean`

Returns `true` if the field is currently required due to `requiredIf` or other config.

```ts
const required = store.isRequired("company.taxId");
```

### Field configuration: `fields` vs `registerField`

There are two ways to configure field behavior (e.g. `showIf`, `requiredIf`, `asyncValidate`):

| Approach | When to use |
|----------|-------------|
| **`fields`** (in `BitConfig`) | Form structure is known at store creation. Register all fields upfront in one place. |
| **`registerField`** | Fields are dynamic (array items, lazy-loaded) or config comes from components. Used internally by `useBitField` / `injectBitField`. |

**Example with `fields` (declarative, at construction):**

```ts
const store = new BitStore({
  initialValues: { documentType: "CPF", documentNumber: "" },
  fields: {
    documentNumber: {
      conditional: {
        dependsOn: ["documentType"],
        showIf: (values) => values.documentType === "CNPJ",
        requiredIf: (values) => values.documentType === "CNPJ",
      },
    },
  },
});
```

**Example with `registerField` (imperative, at runtime):**

```ts
store.registerField("company.taxId", {
  conditional: {
    dependsOn: ["company.country"],
    showIf: (values) => values.company?.country === "BR",
  },
});
```

### `registerField(path: string, config: BitFieldDefinition<T>): void`

Registers or updates the configuration for a single field path after the store has been created. Ideal for dynamic fields or when passing config from a component.

```ts
store.registerField("company.taxId", {
  conditional: {
    dependsOn: ["company.country"],
    showIf: (values) => values.company?.country === "BR",
  },
});
```

### `unregisterField(path: string): void`

Unregisters a single field from the dependency manager and removes its `errors` and `touched` entries from the state.

```ts
store.unregisterField("company.name");
```

### `unregisterPrefix(prefix: string): void`

Unregisters all fields whose path starts with the given prefix. Useful for dynamic sections.

```ts
// Unregister all fields under "items[0]"
store.unregisterPrefix("items[0]");
```

---

## Arrays & Field Lists

Array operations delegate to the internal `BitArrayManager` and keep errors/touched state in sync.

All methods receive a **path to an array field** plus indices/values.

- `pushItem(path: string, value: any): void`
- `prependItem(path: string, value: any): void`
- `insertItem(path: string, index: number, value: any): void`
- `removeItem(path: string, index: number): void`
- `swapItems(path: string, indexA: number, indexB: number): void`
- `moveItem(path: string, fromIndex: number, toIndex: number): void`

```ts
store.pushItem("items", { name: "", price: 0 });
store.removeItem("items", 2);
store.moveItem("items", 0, 1);
```

---

## History & Time‑Travel

History is enabled by setting `history: { enabled: true }` in the `BitConfig`. The store will save snapshots at key points (such as `blurField` and other lifecycle events).

### `canUndo: boolean` / `canRedo: boolean`

Flags indicating whether there is a previous or next snapshot to navigate to.

```ts
if (store.canUndo) {
  store.undo();
}
```

### `undo(): void`

Restores the previous snapshot of `values` and re-runs validation.

### `redo(): void`

Restores the next snapshot of `values` and re-runs validation.

```ts
store.undo();
store.redo();
```

---

## Masks

### `registerMask(name: string, mask: BitMask): void`

Registers a custom mask that can be referenced by name in field configs.

```ts
store.registerMask("customCurrency", {
  // custom BitMask implementation
});
```

Masks are available via `store.getConfig().masks` (includes built-in and any registered via `registerMask`).

---

## Multi‑Step Flows & Scopes

### `getStepStatus(scopeName: string): { hasErrors: boolean; isDirty: boolean }`

Returns a summary of the state of a scope (typically a wizard step) based on `BitConfig.scopes[scopeName]`.

```ts
const shippingStatus = store.getStepStatus("shipping");

if (shippingStatus.hasErrors) {
  // show a badge on the step
}
```

### `isFieldDirty(path: string): boolean`

Checks whether a single field differs from its initial value.

```ts
if (store.isFieldDirty("address.zip")) {
  // enable a "Reset field" button
}
```

---

## Submission Lifecycle

### `submit(onSuccess: (values: T) => void | Promise<void>): Promise<void>`

Runs the full submission lifecycle through the internal `BitLifecycleManager`:

1. Cancels any pending validations.
2. Marks `isSubmitting` as `true`.
3. Runs full validation.
4. Strips values for hidden fields.
5. Applies any `transform` functions from the config.
6. Calls `onSuccess(cleanValues)`.
7. Marks `isSubmitting` as `false`.

In frameworks, you typically use this as a wrapper around a submit handler:

```ts
const onSubmit = store.submit(async (values) => {
  await api.saveForm(values);
});
```

In React, the `useBitForm` hook wraps this to automatically prevent the default submit event.

---

## Cleanup

### `cleanup(): void`

Disposes the store completely:

- Clears all subscription listeners.
- Cancels any pending validations.
- Removes the store from the internal `bitBus` registry (used by DevTools).

Call this when a store is no longer needed (e.g. when unmounting a long-lived custom instance).

```ts
store.cleanup();
```
